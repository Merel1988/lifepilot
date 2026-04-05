import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.url !== undefined) data.url = body.url;
  if (body.folder !== undefined) data.folder = body.folder;
  if (body.color !== undefined) data.color = body.color;
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const feed = await prisma.calendarFeed.update({ where: { id }, data });
  return Response.json(feed);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  await prisma.calendarFeed.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
