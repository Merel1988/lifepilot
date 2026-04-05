import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const feeds = await prisma.calendarFeed.findMany({
    orderBy: { createdAt: "asc" },
  });

  return Response.json(feeds);
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();

  const feed = await prisma.calendarFeed.create({
    data: {
      name: body.name,
      url: body.url,
      folder: body.folder || "PRIVE",
      color: body.color || "#2563eb",
      enabled: body.enabled ?? true,
    },
  });

  return Response.json(feed, { status: 201 });
}
