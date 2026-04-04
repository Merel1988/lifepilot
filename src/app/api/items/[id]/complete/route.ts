import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

// Toggle completion of a recurring task for a specific date
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();
  const date: string = body.date; // YYYY-MM-DD

  const existing = await prisma.recurrenceCompletion.findUnique({
    where: { itemId_date: { itemId: id, date } },
  });

  if (existing) {
    await prisma.recurrenceCompletion.delete({
      where: { id: existing.id },
    });
    return Response.json({ completed: false });
  } else {
    await prisma.recurrenceCompletion.create({
      data: { itemId: id, date },
    });
    return Response.json({ completed: true });
  }
}
