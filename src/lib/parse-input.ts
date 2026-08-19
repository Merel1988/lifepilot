/**
 * Eén tekstveld in plaats van een formulier met acht velden.
 *
 * "morgen 9u tandarts" wordt een herinnering voor morgen om 09:00 met de titel
 * "Tandarts". Wat de parser begrijpt haalt hij uit de tekst weg; wat overblijft
 * is de titel. De UI toont altijd wát hij ervan gemaakt heeft (zie QuickAdd),
 * want een stille verkeerde gok is erger dan geen gok — daarom gokt deze parser
 * ook nooit een categorie op basis van de klok, alleen op basis van woorden.
 *
 * Bewuste keuzes:
 * - Een weekdag zonder "volgende" betekent de éérstvolgende, vandaag meegerekend
 *   ("vrijdag" op vrijdag = vandaag). De preview toont de datum, dus je ziet het.
 * - Een uur van 1 t/m 7 zonder dagdeel wordt 's middags/'s avonds gelezen
 *   ("6u" -> 18:00). "6u 's ochtends" of "morgenochtend 6u" blijft 06:00.
 * - Een tijd maakt het een herinnering, want alleen die kan een melding sturen.
 */

import { addDays, dayToUTC, localDay, MONTH_NAMES, WEEKDAY_NAMES } from "@/lib/day";
import type { ItemType, MainFolder } from "@/lib/folders";

export interface ParsedInput {
  title: string;
  type: ItemType;
  /** YYYY-MM-DD, of null voor "ooit" (en altijd null bij herhaling). */
  date: string | null;
  /** HH:mm, of null. */
  time: string | null;
  /** null = niets gevonden in de tekst; de UI kiest dan zelf een standaard. */
  folder: MainFolder | null;
  recurring: boolean;
  /** Weekdagnummers, 0 = zondag. */
  recurrenceDays: number[];
  /** De stukjes tekst die zijn omgezet, voor uitleg in de preview. */
  understood: string[];
}

type DayPart = "ochtend" | "middag" | "avond" | null;

const MONTHS: string[] = MONTH_NAMES;

/** Losse afkortingen naast de volledige namen uit day.ts. */
const WEEKDAY_ABBR: Record<string, number> = {
  ma: 1,
  di: 2,
  wo: 3,
  do: 4,
  vr: 5,
  za: 6,
  zo: 0,
};

const FOLDER_KEYWORDS: { folder: MainFolder; words: string[] }[] = [
  { folder: "JANNIE_MEPPEL", words: ["jannie", "meppel"] },
  {
    folder: "WERK",
    words: [
      "werk",
      "kantoor",
      "vergadering",
      "overleg",
      "collega",
      "collega's",
      "klant",
      "deadline",
      "standup",
      "sprint",
      "review",
      "baas",
    ],
  },
];

/** Expliciete labels: #werk, #prive, #jannie. Die winnen altijd. */
const FOLDER_TAGS: { folder: MainFolder; pattern: RegExp }[] = [
  { folder: "PRIVE", pattern: /#(prive|privé)\b/i },
  { folder: "WERK", pattern: /#werk\b/i },
  { folder: "JANNIE_MEPPEL", pattern: /#(jannie|meppel)\b/i },
];

/** Zoekt het patroon, haalt het uit de tekst en geeft de match terug. */
function take(text: string, pattern: RegExp): { rest: string; match: RegExpMatchArray | null } {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return { rest: text, match: null };
  const rest = text.slice(0, match.index) + " " + text.slice(match.index + match[0].length);
  return { rest, match };
}

function weekdayPattern(): string {
  const names = WEEKDAY_NAMES.join("|");
  const abbr = Object.keys(WEEKDAY_ABBR).join("|");
  return `(${names}|${abbr})`;
}

function weekdayNumber(word: string): number | null {
  const w = word.toLowerCase();
  const full = WEEKDAY_NAMES.indexOf(w);
  if (full >= 0) return full;
  return w in WEEKDAY_ABBR ? WEEKDAY_ABBR[w] : null;
}

/** De eerstvolgende dag met deze weekdag. Vandaag telt mee tenzij anders. */
function nextWeekday(today: string, weekday: number, includeToday = true): string {
  const current = dayToUTC(today).getUTCDay();
  let diff = (weekday - current + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(today, diff);
}

function monthNumber(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, "");
  const exact = MONTHS.indexOf(w);
  if (exact >= 0) return exact + 1;
  const short = MONTHS.findIndex((m) => m.slice(0, 3) === w.slice(0, 3) && w.length >= 3);
  return short >= 0 ? short + 1 : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Een uur uit de tekst naar een 24-uursklok. Zonder dagdeel wordt 1 t/m 7
 * 's middags gelezen; niemand zet een herinnering voor half 2 's nachts.
 */
function toClock(hour: number, minute: number, part: DayPart): string | null {
  if (hour > 23 || minute > 59) return null;
  let h = hour;
  if (part === "ochtend") {
    if (h === 12) h = 0;
  } else if (part === "middag" || part === "avond") {
    if (h < 12) h += 12;
  } else if (h >= 1 && h <= 7) {
    h += 12;
  }
  return `${pad(h % 24)}:${pad(minute)}`;
}

export function parseQuickInput(
  input: string,
  options: { today?: string; defaultType?: ItemType } = {}
): ParsedInput {
  const today = options.today ?? localDay();
  const understood: string[] = [];
  let rest = ` ${input} `;

  let type: ItemType | null = null;
  let date: string | null = null;
  let time: string | null = null;
  let folder: MainFolder | null = null;
  let recurrenceDays: number[] = [];
  let dayPart: DayPart = null;

  function found(match: RegExpMatchArray) {
    understood.push(match[0].trim());
  }

  // 1. Type als expliciet voorvoegsel: "notitie: ..." / "idee: ..."
  {
    const { rest: r, match } = take(rest, /\b(notitie|note|idee|gedachte)\s*:/i);
    if (match) {
      type = "NOTE";
      rest = r;
      found(match);
    }
  }

  // 2. Categorie: #tag wint, anders trefwoorden (die blijven in de titel staan)
  for (const tag of FOLDER_TAGS) {
    const { rest: r, match } = take(rest, tag.pattern);
    if (match) {
      folder = tag.folder;
      rest = r;
      found(match);
      break;
    }
  }
  if (!folder) {
    const lower = rest.toLowerCase();
    for (const entry of FOLDER_KEYWORDS) {
      const hit = entry.words.find((w) =>
        new RegExp(`\\b${w.replace(/'/g, "'")}\\b`, "i").test(lower)
      );
      if (hit) {
        folder = entry.folder;
        break;
      }
    }
  }

  // 3. Herhaling. Staat vóór de losse weekdag, want "elke maandag" is geen datum.
  {
    const patterns: { pattern: RegExp; days: (m: RegExpMatchArray) => number[] }[] = [
      { pattern: /\b(elke|iedere)\s+dag\b|\bdagelijks\b/i, days: () => [0, 1, 2, 3, 4, 5, 6] },
      { pattern: /\b(elke|iedere)\s+werkdag\b/i, days: () => [1, 2, 3, 4, 5] },
      {
        pattern: new RegExp(
          `\\b(?:elke|iedere)\\s+${weekdayPattern()}(?:\\s*(?:,|en|\\/)\\s*${weekdayPattern()})*\\b`,
          "i"
        ),
        days: (m) => {
          const hits = m[0].match(new RegExp(weekdayPattern(), "gi")) ?? [];
          return hits
            .map((h) => weekdayNumber(h))
            .filter((d): d is number => d !== null);
        },
      },
      {
        pattern: /\b(elke|iedere)\s+week\b|\bwekelijks\b/i,
        days: () => [dayToUTC(today).getUTCDay()],
      },
    ];

    for (const { pattern, days } of patterns) {
      const { rest: r, match } = take(rest, pattern);
      if (match) {
        const parsed = days(match);
        if (parsed.length > 0) {
          recurrenceDays = [...new Set(parsed)].sort();
          rest = r;
          found(match);
        }
        break;
      }
    }
  }

  // 4. Dagdeel. Wordt gebruikt om een los uur goed te lezen.
  {
    const { rest: r, match } = take(
      rest,
      /\bvanochtend\b|\bvanmorgen\b|\bmorgenochtend\b|'?s\s?ochtends\b|\bvanmiddag\b|\bmorgenmiddag\b|'?s\s?middags\b|\bvanavond\b|\bmorgenavond\b|'?s\s?avonds\b/i
    );
    if (match) {
      const word = match[0].toLowerCase().replace(/\s+/g, "");
      dayPart = /ochtend|morgenochtend|ochtends/.test(word)
        ? "ochtend"
        : /middag/.test(word)
          ? "middag"
          : "avond";
      // "vanavond" is vandaag, "morgenavond" is morgen
      if (!recurrenceDays.length) {
        date = word.startsWith("morgen") ? addDays(today, 1) : word.startsWith("van") ? today : null;
      }
      rest = r;
      found(match);
    }
  }

  // 5. Datum. Van specifiek naar vaag, zodat "15 september" niet als "15" eindigt.
  if (!recurrenceDays.length && !date) {
    const steps: (() => boolean)[] = [
      // 15 september (2026) / 15 sep
      () => {
        const { rest: r, match } = take(
          rest,
          new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join("|")}|${MONTHS.map((m) => m.slice(0, 3)).join("|")})\\.?(?:\\s+(\\d{4}))?\\b`, "i")
        );
        if (!match) return false;
        const day = Number(match[1]);
        const month = monthNumber(match[2]);
        if (!month || day < 1 || day > 31) return false;
        const year = match[3] ? Number(match[3]) : null;
        date = resolveDate(day, month, year, today);
        rest = r;
        found(match);
        return true;
      },
      // 15-9, 15/9/2026
      () => {
        const { rest: r, match } = take(rest, /\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
        if (!match) return false;
        const day = Number(match[1]);
        const month = Number(match[2]);
        if (day < 1 || day > 31 || month < 1 || month > 12) return false;
        let year = match[3] ? Number(match[3]) : null;
        if (year !== null && year < 100) year += 2000;
        date = resolveDate(day, month, year, today);
        rest = r;
        found(match);
        return true;
      },
      // overmorgen / morgen / vandaag
      () => {
        const { rest: r, match } = take(rest, /\b(overmorgen|morgen|vandaag|nu)\b/i);
        if (!match) return false;
        const word = match[1].toLowerCase();
        date = word === "overmorgen" ? addDays(today, 2) : word === "morgen" ? addDays(today, 1) : today;
        rest = r;
        found(match);
        return true;
      },
      // over 3 dagen / over een week / over 2 maanden
      () => {
        const { rest: r, match } = take(
          rest,
          /\bover\s+(\d{1,3}|een|twee|drie|vier)\s+(dag|dagen|week|weken|maand|maanden)\b/i
        );
        if (!match) return false;
        const words: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4 };
        const amount = words[match[1].toLowerCase()] ?? Number(match[1]);
        const unit = match[2].toLowerCase();
        date = unit.startsWith("dag")
          ? addDays(today, amount)
          : unit.startsWith("week")
            ? addDays(today, amount * 7)
            : addMonths(today, amount);
        rest = r;
        found(match);
        return true;
      },
      // volgende week (maandag) / volgende maand
      () => {
        const { rest: r, match } = take(
          rest,
          new RegExp(`\\b(volgende|komende)\\s+(week|maand)(?:\\s+${weekdayPattern()})?\\b`, "i")
        );
        if (!match) return false;
        if (match[2].toLowerCase() === "maand") {
          date = addMonths(today, 1);
        } else if (match[3]) {
          const weekday = weekdayNumber(match[3]);
          date = weekday === null ? addDays(today, 7) : nextWeekday(addDays(today, 7), weekday);
        } else {
          date = addDays(today, 7);
        }
        rest = r;
        found(match);
        return true;
      },
      // maandag / ma
      () => {
        const { rest: r, match } = take(rest, new RegExp(`\\b${weekdayPattern()}\\b`, "i"));
        if (!match) return false;
        const weekday = weekdayNumber(match[1]);
        if (weekday === null) return false;
        date = nextWeekday(today, weekday);
        rest = r;
        found(match);
        return true;
      },
    ];

    for (const step of steps) {
      if (step()) break;
    }
  }

  // 6. Tijd
  {
    const steps: (() => boolean)[] = [
      // half 10 -> 09:30
      () => {
        const { rest: r, match } = take(rest, /\bhalf\s+(\d{1,2})\b/i);
        if (!match) return false;
        const hour = Number(match[1]);
        if (hour < 1 || hour > 12) return false;
        time = toClock(hour === 1 ? 12 : hour - 1, 30, dayPart);
        rest = r;
        found(match);
        return true;
      },
      // kwart over 8 / kwart voor 8
      () => {
        const { rest: r, match } = take(rest, /\bkwart\s+(over|voor)\s+(\d{1,2})\b/i);
        if (!match) return false;
        const hour = Number(match[2]);
        if (hour < 1 || hour > 12) return false;
        time =
          match[1].toLowerCase() === "over"
            ? toClock(hour, 15, dayPart)
            : toClock(hour === 1 ? 12 : hour - 1, 45, dayPart);
        rest = r;
        found(match);
        return true;
      },
      // 09:00 / 9.30 / 19u30 / 9 uur / om 9
      () => {
        const { rest: r, match } = take(
          rest,
          /\b(?:om\s+)?(\d{1,2})(?:[:.]|\s?u(?:ur)?\s?)(\d{2})\b/i
        );
        if (!match) return false;
        const clock = toClock(Number(match[1]), Number(match[2]), dayPart);
        if (!clock) return false;
        time = clock;
        rest = r;
        found(match);
        return true;
      },
      () => {
        const { rest: r, match } = take(rest, /\b(?:om\s+)?(\d{1,2})\s?u(?:ur)?\b/i);
        if (!match) return false;
        const clock = toClock(Number(match[1]), 0, dayPart);
        if (!clock) return false;
        time = clock;
        rest = r;
        found(match);
        return true;
      },
      () => {
        const { rest: r, match } = take(rest, /\bom\s+(\d{1,2})\b/i);
        if (!match) return false;
        const clock = toClock(Number(match[1]), 0, dayPart);
        if (!clock) return false;
        time = clock;
        rest = r;
        found(match);
        return true;
      },
    ];

    for (const step of steps) {
      if (step()) break;
    }
  }

  // Een tijd betekent een melding, dus een herinnering. Anders het type van de
  // lijst waar je staat, of een taak.
  if (!type) type = time ? "REMINDER" : (options.defaultType ?? "TASK");

  const recurring = recurrenceDays.length > 0;
  if (type === "NOTE") {
    date = null;
    time = null;
  }

  return {
    title: cleanTitle(rest),
    type,
    date: recurring ? null : date,
    time,
    folder,
    recurring,
    recurrenceDays,
    understood,
  };
}

/** Dag+maand naar YYYY-MM-DD. Zonder jaar: dit jaar, of volgend jaar als het al geweest is. */
function resolveDate(day: number, month: number, year: number | null, today: string): string {
  const thisYear = dayToUTC(today).getUTCFullYear();
  const candidate = (y: number) => `${y}-${pad(month)}-${pad(day)}`;
  if (year !== null) return candidate(year);
  const sameYear = candidate(thisYear);
  return sameYear < today ? candidate(thisYear + 1) : sameYear;
}

/** Maanden erbij, met de laatste dag van de maand als plafond (31 jan + 1 = 28 feb). */
function addMonths(day: string, amount: number): string {
  const d = dayToUTC(day);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + amount;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay)))
    .toISOString()
    .slice(0, 10);
}

/**
 * Wat overblijft is de titel: losse verbindingswoordjes en leestekens aan de
 * randen eraf, hoofdletter erop. De woordgrenzen zijn hier belangrijk: zonder
 * `\b` haalde dit "en" van het eind van "zetten" af.
 */
function cleanTitle(rest: string): string {
  let title = rest.replace(/\s+/g, " ").trim();
  let previous = "";
  while (title !== previous) {
    previous = title;
    title = title
      .replace(/^(?:om|op|en)\b\s*/i, "")
      .replace(/^[,\-\u2013:.]+\s*/, "")
      .replace(/\s*\b(?:om|op|en|voor|met|van)$/i, "")
      .replace(/\s*[,\-\u2013:]+$/, "")
      .trim();
  }
  title = title.replace(/\s+([,.!?])/g, "$1").trim();
  if (!title) return "";
  return title.charAt(0).toUpperCase() + title.slice(1);
}
