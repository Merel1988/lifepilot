import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  // Fetch all non-completed items with their dates (and recurring info)
  const items = await prisma.item.findMany({
    where: { completed: false },
    select: {
      id: true,
      type: true,
      date: true,
      recurring: true,
      recurrenceDays: true,
      completions: { select: { date: true } },
    },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

  const counts: Record<string, Record<string, number>> = {
    TASK: { vandaag: 0, "deze-week": 0, "deze-maand": 0, "dit-jaar": 0, ooit: 0 },
    REMINDER: { vandaag: 0, "deze-week": 0, "deze-maand": 0, "dit-jaar": 0, ooit: 0 },
  };

  const todayDayOfWeek = now.getDay();

  for (const item of items) {
    if (item.type !== "TASK" && item.type !== "REMINDER") continue;
    const bucket = counts[item.type];

    if (item.recurring && item.recurrenceDays) {
      // Already completed for today?
      const doneToday = item.completions.some((c) => c.date === todayStr);
      if (doneToday) continue;

      const days = item.recurrenceDays.split(",").map(Number);
      if (days.includes(todayDayOfWeek)) {
        bucket.vandaag++;
      } else {
        // Check rest of the week
        const endOfWeekDay = 6;
        let inWeek = false;
        for (let d = todayDayOfWeek + 1; d <= endOfWeekDay; d++) {
          if (days.includes(d)) { inWeek = true; break; }
        }
        if (!inWeek && todayDayOfWeek !== 0 && days.includes(0)) inWeek = true;
        if (inWeek) bucket["deze-week"]++;
      }
      continue;
    }

    if (!item.date) {
      bucket.ooit++;
      continue;
    }

    const d = new Date(item.date);
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDate < today) bucket.vandaag++; // overdue → counted under today
    else if (itemDate <= todayEnd) bucket.vandaag++;
    else if (itemDate <= endOfWeek) bucket["deze-week"]++;
    else if (itemDate <= endOfMonth) bucket["deze-maand"]++;
    else if (itemDate <= endOfYear) bucket["dit-jaar"]++;
    else bucket.ooit++;
  }

  return Response.json(counts, {
    headers: { "Cache-Control": "no-store" },
  });
}
