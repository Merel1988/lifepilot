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
  if (body.color !== undefined) data.color = body.color;
  if (body.frequency !== undefined) data.frequency = body.frequency;
  if (body.customDays !== undefined) data.customDays = body.customDays;
  if (body.archived !== undefined) data.archived = body.archived;

  const habit = await prisma.habit.update({
    where: { id },
    data,
  });

  return Response.json(habit);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  await prisma.habit.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
