import { bucketFor, itemDay, localDay } from "@/lib/day";

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

/**
 * De categorie die standaard aan staat bij een nieuw item.
 *
 * Hier stond eerder een gok op basis van de klok: ma–do tussen 08:00 en 16:00
 * werd automatisch WERK. Dat labelde privé-items stil verkeerd zonder dat je
 * het zag. Liever geen gok dan een onzichtbaar verkeerde gok — je kiest zelf.
 */
export function getDefaultFolder(): MainFolder {
  return "PRIVE";
}

/** In welke tijdmap valt dit item? Eén implementatie, in lib/day.ts. */
export function getTimeFolderForDate(date: Date | null, type: string): TimeFolder {
  if (type === "NOTE") return "notities";

  const bucket = bucketFor(itemDay(date), localDay());

  switch (bucket) {
    // Wat te laat is hoort bij vandaag, want daar moet je iets mee
    case "overdue":
    case "today":
      return "vandaag";
    case "week":
      return "deze-week";
    case "month":
      return "deze-maand";
    case "year":
      return "dit-jaar";
    default:
      return "ooit";
  }
}
