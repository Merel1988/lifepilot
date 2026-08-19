import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import webpush from "web-push";
import { localDay, localTime } from "@/lib/day";
import { getTodayCard, summaryLine } from "@/lib/today";
import { birthdayLine } from "@/lib/contacts";

/**
 * Twee soorten meldingen, allebei via deze route.
 *
 * Standaard (geen `mode`): de ochtendkaart. Eén melding per dag met wat er
 * vandaag is. Dit past bij het gratis Vercel-plan, dat één geplande taak per
 * dag toestaat — zie de cron in vercel.json.
 *
 * `?mode=due`: herinneringen die in de komende vijf minuten aan de beurt zijn.
 * Dat werkt alleen als iets deze route ook elke vijf minuten aanroept. Op het
 * gratis plan kan dat niet met een cron; een externe pinger of een betaald plan
 * is daarvoor nodig. De route staat er klaar voor.
 */
export async function GET(request: NextRequest) {
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

  webpush.setVapidDetails("mailto:noreply@lifepilot.app", vapidPublic, vapidPrivate);

  const mode = request.nextUrl.searchParams.get("mode");

  try {
    const notifications =
      mode === "due" ? await dueReminders() : await morningCard();

    if (notifications.length === 0) {
      return Response.json({ sent: 0, notifications: 0 });
    }

    const sent = await deliver(notifications);
    return Response.json({ sent, notifications: notifications.length });
  } catch (error) {
    console.error("Push versturen mislukte:", error);
    return Response.json(
      { error: "Push versturen mislukte." },
      { status: 500 }
    );
  }
}

interface Notification {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** De ochtendkaart als één melding. Stuurt niets op een lege dag. */
async function morningCard(): Promise<Notification[]> {
  const card = await getTodayCard();

  const hasSomething =
    card.timeline.length > 0 ||
    card.untimed.length > 0 ||
    card.overdue.length > 0 ||
    card.birthdays.length > 0 ||
    card.keepInTouch.length > 0;
  if (!hasSomething) return [];

  const notifications: Notification[] = [];

  // Een verjaardag krijgt zijn eigen melding: dit is precies het ding dat je
  // niet wil missen, en het verdrinkt in een samenvattingsregel.
  const jarig = card.birthdays.filter((entry) => entry.inDays === 0);
  if (jarig.length > 0) {
    notifications.push({
      title: jarig.length === 1 ? "Iemand is jarig" : `${jarig.length} jarigen vandaag`,
      body: jarig.map(birthdayLine).join(" · "),
      tag: `verjaardag-${card.day}`,
      url: "/contacten",
    });
  }

  const first = card.timeline.find((entry) => entry.time);
  const extra = first ? ` Eerst: ${first.time} ${first.title}.` : "";

  notifications.push({
    title: "Vandaag",
    body: `${summaryLine(card)}.${extra}`,
    tag: `ochtendkaart-${card.day}`,
    url: "/",
  });

  return notifications;
}

/** Herinneringen die binnen vijf minuten aan de beurt zijn. */
async function dueReminders(): Promise<Notification[]> {
  const now = new Date();
  const day = localDay(now);
  const from = localTime(now);
  const to = localTime(new Date(now.getTime() + 5 * 60 * 1000));

  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const reminders = await prisma.item.findMany({
    where: {
      type: "REMINDER",
      completed: false,
      time: { gte: from, lte: to },
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, title: true, description: true, time: true },
  });

  return reminders.map((reminder) => ({
    title: reminder.title,
    body: reminder.description || `Herinnering om ${reminder.time}`,
    tag: `reminder-${reminder.id}`,
    url: "/",
  }));
}

/** Verstuurt naar alle abonnementen en ruimt verlopen abonnementen op. */
async function deliver(notifications: Notification[]): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;

  for (const notification of notifications) {
    const payload = JSON.stringify(notification);

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
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? (error as { statusCode: number }).statusCode
            : 0;

        // 410 Gone en 404 betekenen: dit abonnement bestaat niet meer
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error(`Push naar ${sub.endpoint.slice(0, 40)}… mislukte:`, error);
        }
      }
    }
  }

  return sent;
}
