import {
  completedOnDay,
  localDay,
  localWeekday,
  parseWeekdays,
  recursOnWeekday,
} from "@/lib/day";

export interface RecurrenceCompletion {
  id: string;
  itemId: string;
  date: string;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface Item {
  id: string;
  title: string;
  description: string | null;
  type: string;
  folder: string;
  date: string | null;
  time: string | null;
  completed: boolean;
  recurring: boolean;
  recurrenceDays: string | null;
  completions?: RecurrenceCompletion[];
  attachments?: AttachmentMeta[];
}

const DAY_LABELS: Record<number, string> = {
  0: "Zo",
  1: "Ma",
  2: "Di",
  3: "Wo",
  4: "Do",
  5: "Vr",
  6: "Za",
};

export function formatRecurrenceDays(days: string): string {
  return parseWeekdays(days)
    .sort()
    .map((d) => DAY_LABELS[d] ?? d)
    .join(", ");
}

export function isRecurringToday(item: Item): boolean {
  if (!item.recurring) return false;
  return recursOnWeekday(item.recurrenceDays, localWeekday());
}

export function isCompletedForDate(item: Item, date: string): boolean {
  return completedOnDay(item.completions, date);
}

/**
 * Hoort een herhalend item in dit tijdvak?
 * - vandaag: als vandaag een herhaaldag is
 * - deze week: als er nog een herhaaldag komt in de rest van deze week
 * - deze maand / dit jaar: altijd, want wekelijks valt daar altijd binnen
 * - ooit / notities: nooit
 */
export function recurringMatchesTimeFolder(item: Item, timeFolder: string): boolean {
  if (!item.recurring) return false;
  const days = parseWeekdays(item.recurrenceDays);
  if (days.length === 0) return false;
  const today = localWeekday();

  switch (timeFolder) {
    case "vandaag":
      return days.includes(today);
    case "deze-week": {
      for (let d = today + 1; d <= 6; d++) {
        if (days.includes(d)) return true;
      }
      // Zondag (0) sluit de week af, dus die telt nog mee
      return today !== 0 && days.includes(0);
    }
    case "deze-maand":
    case "dit-jaar":
      return true;
    default:
      return false;
  }
}

export function getTodayDateString(): string {
  return localDay();
}
