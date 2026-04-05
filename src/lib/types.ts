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
  const dayNumbers = days.split(",").map(Number).sort();
  return dayNumbers.map((d) => DAY_LABELS[d] || d).join(", ");
}

export function isRecurringToday(item: Item): boolean {
  if (!item.recurring || !item.recurrenceDays) return false;
  const today = new Date().getDay();
  return item.recurrenceDays.split(",").map(Number).includes(today);
}

export function isCompletedForDate(item: Item, date: string): boolean {
  return item.completions?.some((c) => c.date === date) ?? false;
}

/**
 * Check if a recurring item should appear in a given time folder.
 * - vandaag: if today is a recurrence day
 * - deze-week: if any recurrence day falls in the remaining days of this week (excluding today)
 * - deze-maand / dit-jaar: always (weekly recurring items always occur within a month)
 * - ooit / notities: never
 */
export function recurringMatchesTimeFolder(item: Item, timeFolder: string): boolean {
  if (!item.recurring || !item.recurrenceDays) return false;
  const days = item.recurrenceDays.split(",").map(Number);
  const today = new Date().getDay();

  switch (timeFolder) {
    case "vandaag":
      return days.includes(today);
    case "deze-week": {
      // Remaining days of the week after today (Sun=0 is end of week)
      const endOfWeekDay = 6; // Saturday
      for (let d = today + 1; d <= endOfWeekDay; d++) {
        if (days.includes(d)) return true;
      }
      // Also check Sunday (0) if today isn't Sunday
      if (today !== 0 && days.includes(0)) return true;
      return false;
    }
    case "deze-maand":
    case "dit-jaar":
      return true; // A weekly recurring item will always occur
    default:
      return false;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
