/**
 * Eén plek voor "welke dag is het" en "in welke tijdvak hoort dit item".
 *
 * Twee dingen zitten hier goed die elders in de app misgaan:
 *
 * 1. Tijdzone. Op Vercel draait de server in UTC, maar de gebruiker leeft in
 *    Nederland. Om 00:30 Nederlandse tijd is het in UTC nog de vorige dag, dus
 *    `new Date().getDate()` op de server geeft dan de verkeerde "vandaag".
 *    Daarom leiden we de kalenderdag altijd af in TIME_ZONE.
 *
 * 2. Items vergelijken. Een `date` in de database is aangemaakt uit een
 *    "YYYY-MM-DD" uit een date-input, dus het staat er als middernacht UTC van
 *    de bedoelde kalenderdag. Met UTC-getters lees je die dag exact terug.
 *    Alles vergelijken we daarom als "YYYY-MM-DD"-string, nooit als tijdstip.
 */

export const TIME_ZONE = "Europe/Amsterdam";

export type Bucket = "overdue" | "today" | "week" | "month" | "year" | "later";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** De kalenderdag in Nederland als "YYYY-MM-DD". */
export function localDay(now: Date = new Date()): string {
  return dayFormatter.format(now); // en-CA geeft al YYYY-MM-DD
}

/** De klok in Nederland als "HH:mm", zelfde formaat als Item.time. */
export function localTime(now: Date = new Date()): string {
  return timeFormatter.format(now);
}

/** Weekdag in Nederland: 0 = zondag, 6 = zaterdag. */
export function localWeekday(now: Date = new Date()): number {
  return dayToUTC(localDay(now)).getUTCDay();
}

/** "YYYY-MM-DD" naar middernacht UTC, zodat rekenen veilig is. */
export function dayToUTC(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** De kalenderdag van een opgeslagen datum, als "YYYY-MM-DD". */
export function itemDay(date: Date | string | null): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number): string {
  const d = dayToUTC(day);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

/**
 * Laatste dag van de huidige week. Volgt de bestaande afspraak in de app:
 * de week loopt door tot en met de komende zondag.
 */
export function endOfWeek(today: string): string {
  const weekday = dayToUTC(today).getUTCDay();
  return addDays(today, 7 - weekday);
}

export function endOfMonth(today: string): string {
  const d = dayToUTC(today);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

export function endOfYear(today: string): string {
  return `${dayToUTC(today).getUTCFullYear()}-12-31`;
}

/**
 * In welk tijdvak hoort een item met deze datum? Geen datum betekent "ooit".
 * Dit is de enige plek waar deze indeling hoort te staan.
 */
export function bucketFor(day: string | null, today: string): Bucket {
  if (!day) return "later";
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day <= endOfWeek(today)) return "week";
  if (day <= endOfMonth(today)) return "month";
  if (day <= endOfYear(today)) return "year";
  return "later";
}

/** Weekdagnummers uit een "1,2,3"-veld, ongeldige waarden eruit. */
export function parseWeekdays(days: string | null): number[] {
  if (!days) return [];
  return days
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

export function recursOnWeekday(
  recurrenceDays: string | null,
  weekday: number
): boolean {
  return parseWeekdays(recurrenceDays).includes(weekday);
}

/** Is dit herhalende item al afgevinkt voor deze dag? */
export function completedOnDay(
  completions: { date: string }[] | undefined,
  day: string
): boolean {
  return completions?.some((c) => c.date === day) ?? false;
}

/** Moet een gewoonte vandaag gedaan worden? */
export function habitDueOnWeekday(
  habit: { frequency: string; customDays: string | null },
  weekday: number
): boolean {
  switch (habit.frequency) {
    case "DAILY":
      return true;
    case "WEEKDAYS":
      return weekday >= 1 && weekday <= 5;
    case "CUSTOM":
      return recursOnWeekday(habit.customDays, weekday);
    default:
      return false;
  }
}
