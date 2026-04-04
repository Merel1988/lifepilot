export type MainFolder = "PRIVE" | "WERK" | "JANNIE_MEPPEL";
export type ItemType = "TASK" | "REMINDER" | "NOTE";
export type TimeFolder =
  | "vandaag"
  | "deze-week"
  | "deze-maand"
  | "dit-jaar"
  | "ooit"
  | "notities";

export const MAIN_FOLDERS: { id: MainFolder; label: string }[] = [
  { id: "PRIVE", label: "Privé" },
  { id: "WERK", label: "Werk" },
  { id: "JANNIE_MEPPEL", label: "Jannie Meppel" },
];

export const TIME_FOLDERS: { id: TimeFolder; label: string }[] = [
  { id: "vandaag", label: "Vandaag" },
  { id: "deze-week", label: "Deze week" },
  { id: "deze-maand", label: "Deze maand" },
  { id: "dit-jaar", label: "Dit jaar" },
  { id: "ooit", label: "Ooit" },
  { id: "notities", label: "Notities" },
];

export const ITEM_TYPES: { id: ItemType; label: string }[] = [
  { id: "TASK", label: "Taak" },
  { id: "REMINDER", label: "Herinnering" },
  { id: "NOTE", label: "Notitie" },
];

export function getDefaultFolder(): MainFolder {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = now.getHours();

  // Mon(1) - Thu(4), 08:00 - 16:00 → WERK
  if (day >= 1 && day <= 4 && hour >= 8 && hour < 16) {
    return "WERK";
  }
  return "PRIVE";
}

export function getTimeFolderForDate(date: Date | null, type: string): TimeFolder {
  if (type === "NOTE") return "notities";
  if (!date) return "ooit";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Vandaag
  if (itemDate.getTime() === today.getTime()) return "vandaag";

  // Deze week (remaining days of current week)
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  if (itemDate <= endOfWeek && itemDate > today) return "deze-week";

  // Deze maand
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (itemDate <= endOfMonth && itemDate > today) return "deze-maand";

  // Dit jaar
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  if (itemDate <= endOfYear && itemDate > today) return "dit-jaar";

  // Past dates go to vandaag (overdue)
  if (itemDate < today) return "vandaag";

  // More than a year in the future
  return "ooit";
}
