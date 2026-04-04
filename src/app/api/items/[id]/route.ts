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
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.type !== undefined) data.type = body.type;
  if (body.folder !== undefined) data.folder = body.folder;
  if (body.completed !== undefined) data.completed = body.completed;
  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
  if (body.time !== undefined) data.time = body.time || null;
  if (body.recurring !== undefined) data.recurring = body.recurring;
  if (body.recurrenceDays !== undefined) data.recurrenceDays = body.recurrenceDays;

  const item = await prisma.item.update({
    where: { id },
    data,
  });

  return Response.json(item);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;

  await prisma.item.delete({
    where: { id },
  });

  return new Response(null, { status: 204 });
}
