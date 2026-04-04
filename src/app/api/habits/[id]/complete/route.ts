import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const date: string = body.date; // YYYY-MM-DD

  const existing = await prisma.habitCompletion.findUnique({
    where: { habitId_date: { habitId: id, date } },
  });

  if (existing) {
    await prisma.habitCompletion.delete({ where: { id: existing.id } });
    return Response.json({ completed: false });
  } else {
    await prisma.habitCompletion.create({ data: { habitId: id, date } });
    return Response.json({ completed: true });
  }
}
