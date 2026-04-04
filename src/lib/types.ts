export interface RecurrenceCompletion {
  id: string;
  itemId: string;
  date: string;
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

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
