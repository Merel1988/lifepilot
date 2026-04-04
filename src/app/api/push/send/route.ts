import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import webpush from "web-push";

// Called by Vercel Cron (GET) to check for due reminders and send push notifications
export async function GET(request: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(
    "mailto:noreply@lifepilot.app",
    vapidPublic,
    vapidPrivate
  );

  // Find reminders due in the next 5 minutes
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
  const laterTime = `${String(fiveMinLater.getHours()).padStart(2, "0")}:${String(fiveMinLater.getMinutes()).padStart(2, "0")}`;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const reminders = await prisma.item.findMany({
    where: {
      type: "REMINDER",
      completed: false,
      time: { gte: currentTime, lte: laterTime },
      date: { gte: todayStart, lte: todayEnd },
    },
  });

  if (reminders.length === 0) {
    return Response.json({ sent: 0 });
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;

  for (const reminder of reminders) {
    const payload = JSON.stringify({
      title: reminder.title,
      body: reminder.description || `Herinnering: ${reminder.title}`,
      tag: `reminder-${reminder.id}`,
      url: "/",
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (error: unknown) {
        // Remove invalid subscriptions (410 Gone)
        if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }
  }

  return Response.json({ sent, reminders: reminders.length });
}
