import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const folder = searchParams.get("folder");
  const type = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const completed = searchParams.get("completed");
  const hasDate = searchParams.get("hasDate");
  const includeRecurring = searchParams.get("includeRecurring");

  const where: Record<string, unknown> = {};

  if (folder) where.folder = folder;
  if (type) where.type = type;
  if (completed !== null && completed !== undefined && completed !== "") {
    where.completed = completed === "true";
  }

  // For recurring items, don't filter by date — they repeat
  const conditions: Record<string, unknown>[] = [];

  if (hasDate === "false") {
    where.date = null;
  } else if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    if (includeRecurring === "true") {
      // Return items matching date range OR recurring items
      conditions.push({ ...where, date: dateFilter, recurring: false });
      conditions.push({ ...where, recurring: true });
    } else {
      where.date = dateFilter;
    }
  }

  const items = await prisma.item.findMany({
    where: conditions.length > 0 ? { OR: conditions } : where,
    include: { completions: true },
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });

  return Response.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const item = await prisma.item.create({
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type || "TASK",
      folder: body.folder,
      date: body.date ? new Date(body.date) : null,
      time: body.time || null,
      completed: false,
      recurring: body.recurring || false,
      recurrenceDays: body.recurrenceDays || null,
    },
  });

  return Response.json(item, { status: 201 });
}
