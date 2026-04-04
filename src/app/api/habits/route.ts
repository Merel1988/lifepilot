import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const where: Record<string, unknown> = {};
  if (!includeArchived) where.archived = false;

  const completionWhere: Record<string, unknown> = {};
  if (dateFrom && dateTo) {
    completionWhere.date = { gte: dateFrom, lte: dateTo };
  }

  const habits = await prisma.habit.findMany({
    where,
    include: {
      completions: {
        where: Object.keys(completionWhere).length > 0 ? completionWhere : undefined,
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(habits);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const habit = await prisma.habit.create({
    data: {
      name: body.name,
      color: body.color || "#2563eb",
      frequency: body.frequency || "DAILY",
      customDays: body.customDays || null,
    },
  });

  return Response.json(habit, { status: 201 });
}
