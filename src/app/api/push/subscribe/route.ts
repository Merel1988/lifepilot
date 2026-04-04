import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Upsert: update if endpoint exists, create if not
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const { endpoint } = body;

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  return Response.json({ ok: true });
}
