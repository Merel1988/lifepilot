import { prisma } from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/calendar";
import {
  completedOnDay,
  dayToUTC,
  habitDueOnWeekday,
  itemDay,
  localDay,
  localTime,
  localWeekday,
  recursOnWeekday,
} from "@/lib/day";

/** Een regel op de tijdlijn: een afspraak of een taak met een tijd. */
export interface TimelineEntry {
  kind: "event" | "task";
  id: string;
  time: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  done: boolean;
  color: string | null;
}

/** Een regel zonder tijd: taak, herhalende taak of gewoonte. */
export interface CheckEntry {
  kind: "task" | "habit";
  id: string;
  title: string;
  category: string | null;
  done: boolean;
  recurring: boolean;
  color: string | null;
}

export interface OverdueEntry {
  id: string;
  title: string;
  category: string | null;
  day: string | null;
}

export interface TodayCard {
  /** De kalenderdag in Nederland, "YYYY-MM-DD". */
  day: string;
  /** De klok in Nederland toen deze kaart werd samengesteld, "HH:mm". */
  now: string;
  summary: {
    appointments: number;
    todo: number;
    meal: string | null;
  };
  timeline: TimelineEntry[];
  untimed: CheckEntry[];
  overdue: OverdueEntry[];
  done: CheckEntry[];
  meal: { title: string; note: string | null } | null;
  calendar: {
    feeds: number;
    failed: { name: string; reason: string }[];
  };
}

const DUTCH_DAYS = [
  "Zondag",
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
];

const CATEGORY_LABELS: Record<string, string> = {
  PRIVE: "privé",
  WERK: "werk",
  JANNIE_MEPPEL: "jannie",
};

function categoryLabel(folder: string | null): string | null {
  if (!folder) return null;
  return CATEGORY_LABELS[folder] ?? folder.toLowerCase();
}

/** Wat eten we vandaag, volgens het laatste weekmenu van deze week. */
function mealForToday(
  plan: { data: string } | null,
  weekday: number
): { title: string; note: string | null } | null {
  if (!plan) return null;

  try {
    const parsed = JSON.parse(plan.data) as {
      dagen?: { dag?: string; type?: string; maaltijd?: string; notitie?: string }[];
    };
    const dayName = DUTCH_DAYS[weekday];
    const entry = parsed.dagen?.find(
      (d) => d.dag === dayName && (d.type ?? "avondeten") === "avondeten"
    );
    if (!entry?.maaltijd) return null;
    return { title: entry.maaltijd, note: entry.notitie ?? null };
  } catch {
    // Een onleesbaar plan mag de hele ochtendkaart niet slopen
    return null;
  }
}

/**
 * Stelt de ochtendkaart samen: afspraken en taken door elkaar op één tijdlijn,
 * daaronder wat geen tijd heeft, en wat er gegeten wordt.
 *
 * Dit is de enige plek waar deze samenstelling gebeurt — zowel de pagina als
 * /api/today als de ochtend-push gebruiken deze functie.
 */
export async function getTodayCard(): Promise<TodayCard> {
  const now = new Date();
  const day = localDay(now);
  const weekday = localWeekday(now);

  const dayStart = dayToUTC(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Maandag van deze week, voor het weekmenu
  const monday = new Date(dayStart);
  monday.setUTCDate(monday.getUTCDate() - ((weekday + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10);

  const [items, habits, plan, calendar] = await Promise.all([
    // Alles wat vandaag kan raken: open items tot en met vandaag, alle
    // herhalende items, plus wat vandaag al is afgevinkt.
    prisma.item.findMany({
      where: {
        type: { in: ["TASK", "REMINDER"] },
        OR: [
          { completed: false, recurring: true },
          { completed: false, date: { lte: dayEnd } },
          { completed: true, date: { gte: dayStart, lte: dayEnd } },
        ],
      },
      select: {
        id: true,
        title: true,
        folder: true,
        date: true,
        time: true,
        completed: true,
        recurring: true,
        recurrenceDays: true,
        completions: { select: { date: true } },
      },
      orderBy: [{ time: "asc" }, { createdAt: "asc" }],
    }),
    prisma.habit.findMany({
      where: { archived: false },
      select: {
        id: true,
        name: true,
        color: true,
        frequency: true,
        customDays: true,
        completions: { where: { date: day }, select: { date: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mealPlan.findFirst({
      where: { weekStart },
      orderBy: { createdAt: "desc" },
      select: { data: true },
    }),
    getCalendarEvents({ from: dayStart, to: dayEnd }),
  ]);

  const timeline: TimelineEntry[] = [];
  const untimed: CheckEntry[] = [];
  const overdue: OverdueEntry[] = [];
  const done: CheckEntry[] = [];

  for (const item of items) {
    const itemDayStr = itemDay(item.date);
    const category = categoryLabel(item.folder);

    if (item.recurring) {
      // Herhalende items horen alleen bij de dagen die ze zelf noemen
      if (!recursOnWeekday(item.recurrenceDays, weekday)) continue;

      const isDone = completedOnDay(item.completions, day);
      const entry: CheckEntry = {
        kind: "task",
        id: item.id,
        title: item.title,
        category,
        done: isDone,
        recurring: true,
        color: null,
      };
      if (isDone) done.push(entry);
      else if (item.time) {
        timeline.push({
          kind: "task",
          id: item.id,
          time: item.time,
          title: item.title,
          subtitle: null,
          category,
          done: false,
          color: null,
        });
      } else {
        untimed.push(entry);
      }
      continue;
    }

    if (item.completed) {
      if (itemDayStr === day) {
        done.push({
          kind: "task",
          id: item.id,
          title: item.title,
          category,
          done: true,
          recurring: false,
          color: null,
        });
      }
      continue;
    }

    if (itemDayStr && itemDayStr < day) {
      overdue.push({ id: item.id, title: item.title, category, day: itemDayStr });
      continue;
    }

    if (itemDayStr !== day) continue;

    if (item.time) {
      timeline.push({
        kind: "task",
        id: item.id,
        time: item.time,
        title: item.title,
        subtitle: null,
        category,
        done: false,
        color: null,
      });
    } else {
      untimed.push({
        kind: "task",
        id: item.id,
        title: item.title,
        category,
        done: false,
        recurring: false,
        color: null,
      });
    }
  }

  for (const habit of habits) {
    if (!habitDueOnWeekday(habit, weekday)) continue;
    const entry: CheckEntry = {
      kind: "habit",
      id: habit.id,
      title: habit.name,
      category: "gewoonte",
      done: habit.completions.length > 0,
      recurring: true,
      color: habit.color,
    };
    if (entry.done) done.push(entry);
    else untimed.push(entry);
  }

  for (const event of calendar.events) {
    timeline.push({
      kind: "event",
      id: event.uid,
      time: event.allDay ? "" : localTime(new Date(event.start)),
      title: event.summary,
      subtitle: event.location || event.feedName,
      category: null,
      done: false,
      color: event.feedColor,
    });
  }

  // Hele dagen eerst, daarna op tijd. Dit is wat de kaart uniek maakt:
  // afspraken en taken staan door elkaar in plaats van in twee blokken.
  timeline.sort((a, b) => {
    if (!a.time && b.time) return -1;
    if (a.time && !b.time) return 1;
    return a.time.localeCompare(b.time);
  });

  const meal = mealForToday(plan, weekday);

  return {
    day,
    now: localTime(now),
    summary: {
      appointments: calendar.events.length,
      todo: timeline.filter((t) => t.kind === "task").length + untimed.length,
      meal: meal?.title ?? null,
    },
    timeline,
    untimed,
    overdue,
    done,
    meal,
    calendar: { feeds: calendar.feeds, failed: calendar.failed },
  };
}

/** Eén regel samenvatting, voor de push-melding en boven de kaart. */
export function summaryLine(card: TodayCard): string {
  const parts: string[] = [];
  if (card.summary.appointments > 0) {
    parts.push(
      card.summary.appointments === 1
        ? "1 afspraak"
        : `${card.summary.appointments} afspraken`
    );
  }
  if (card.summary.todo > 0) {
    parts.push(`${card.summary.todo} te doen`);
  }
  if (card.summary.meal) {
    parts.push(card.summary.meal.toLowerCase());
  }
  if (parts.length === 0) return "Niks vandaag — fijn";
  return parts.join(" · ");
}
