import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import {
  bucketFor,
  completedOnDay,
  itemDay,
  localDay,
  localWeekday,
  parseWeekdays,
} from "@/lib/day";

type Counts = Record<string, Record<string, number>>;

/**
 * De aantallen achter de menu-items. Gebruikt dezelfde tijdindeling als de rest
 * van de app (lib/day.ts) — anders zegt het menu "3" waar de lijst er twee toont.
 */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const items = await prisma.item.findMany({
      where: { completed: false, type: { in: ["TASK", "REMINDER"] } },
      select: {
        type: true,
        date: true,
        recurring: true,
        recurrenceDays: true,
        completions: { select: { date: true } },
      },
    });

    const today = localDay();
    const weekday = localWeekday();

    const counts: Counts = {
      TASK: { vandaag: 0, "deze-week": 0, "deze-maand": 0, "dit-jaar": 0, ooit: 0 },
      REMINDER: { vandaag: 0, "deze-week": 0, "deze-maand": 0, "dit-jaar": 0, ooit: 0 },
    };

    for (const item of items) {
      const bucketCounts = counts[item.type];
      if (!bucketCounts) continue;

      if (item.recurring) {
        // Vandaag al afgevinkt? Dan telt hij vandaag niet meer mee.
        if (completedOnDay(item.completions, today)) continue;

        const days = parseWeekdays(item.recurrenceDays);
        if (days.length === 0) continue;

        if (days.includes(weekday)) {
          bucketCounts.vandaag++;
          continue;
        }

        // Komt er nog een herhaaldag in de rest van deze week? Zondag sluit af.
        const laterThisWeek =
          days.some((d) => d > weekday) || (weekday !== 0 && days.includes(0));
        bucketCounts[laterThisWeek ? "deze-week" : "deze-maand"]++;
        continue;
      }

      const bucket = bucketFor(itemDay(item.date), today);

      switch (bucket) {
        // Achterstallig hoort bij vandaag: daar moet je iets mee
        case "overdue":
        case "today":
          bucketCounts.vandaag++;
          break;
        case "week":
          bucketCounts["deze-week"]++;
          break;
        case "month":
          bucketCounts["deze-maand"]++;
          break;
        case "year":
          bucketCounts["dit-jaar"]++;
          break;
        default:
          bucketCounts.ooit++;
      }
    }

    return Response.json(counts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Aantallen berekenen mislukte:", error);
    return Response.json({ error: "Aantallen konden niet worden geladen." }, { status: 500 });
  }
}
