import { dayToUTC } from "@/lib/day";

/** Hoeveel dagen vooruit we een verjaardag al aankondigen. */
export const BIRTHDAY_LOOKAHEAD_DAYS = 7;

/** Standaard-interval als je "af en toe contact" aanzet zonder getal te kiezen. */
export const DEFAULT_KEEP_IN_TOUCH_WEEKS = 8;

export interface BirthdayEntry {
  id: string;
  name: string;
  /** Leeftijd die ze worden, of null als het geboortejaar onbekend is. */
  age: number | null;
  /** 0 = vandaag, 1 = morgen, enzovoort. */
  inDays: number;
  day: string;
}

export interface KeepInTouchEntry {
  id: string;
  name: string;
  /** Aantal hele weken sinds het laatste contact, of null als nooit. */
  weeksSince: number | null;
}

interface ContactLike {
  id: string;
  name: string;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  keepInTouchWeeks: number | null;
  lastContactAt: Date | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * De eerstvolgende keer dat deze verjaardag valt, als "YYYY-MM-DD".
 * Vandaag telt als vandaag, niet als volgend jaar.
 *
 * 29 februari schuift in een niet-schrikkeljaar naar 1 maart, zodat de
 * verjaardag niet drie jaar op rij wordt overgeslagen.
 */
export function nextBirthday(
  month: number,
  day: number,
  today: string
): { day: string; inDays: number } {
  const todayDate = dayToUTC(today);
  const year = todayDate.getUTCFullYear();

  for (const candidateYear of [year, year + 1]) {
    const exists =
      new Date(Date.UTC(candidateYear, month - 1, day)).getUTCMonth() === month - 1;
    const target = exists
      ? `${candidateYear}-${pad(month)}-${pad(day)}`
      : `${candidateYear}-03-01`;

    if (target >= today) {
      const inDays = Math.round(
        (dayToUTC(target).getTime() - todayDate.getTime()) / 86_400_000
      );
      return { day: target, inDays };
    }
  }

  // Onbereikbaar, maar TypeScript wil een zekerheid
  return { day: today, inDays: 0 };
}

/** Verjaardagen van vandaag en de komende week, op datum. */
export function upcomingBirthdays(
  contacts: ContactLike[],
  today: string,
  lookaheadDays: number = BIRTHDAY_LOOKAHEAD_DAYS
): BirthdayEntry[] {
  const entries: BirthdayEntry[] = [];

  for (const contact of contacts) {
    if (!contact.birthDay || !contact.birthMonth) continue;

    const next = nextBirthday(contact.birthMonth, contact.birthDay, today);
    if (next.inDays > lookaheadDays) continue;

    entries.push({
      id: contact.id,
      name: contact.name,
      age: contact.birthYear
        ? dayToUTC(next.day).getUTCFullYear() - contact.birthYear
        : null,
      inDays: next.inDays,
      day: next.day,
    });
  }

  return entries.sort((a, b) => a.inDays - b.inDays);
}

/**
 * Wie is aan de beurt voor een berichtje? Alleen contacten waar je zelf een
 * interval hebt ingesteld — de app gaat niet ongevraagd over iedereen zeuren.
 */
export function keepInTouchDue(
  contacts: ContactLike[],
  now: Date = new Date()
): KeepInTouchEntry[] {
  const due: KeepInTouchEntry[] = [];

  for (const contact of contacts) {
    if (!contact.keepInTouchWeeks || contact.keepInTouchWeeks <= 0) continue;

    if (!contact.lastContactAt) {
      // Nog nooit afgevinkt: meteen aan de beurt
      due.push({ id: contact.id, name: contact.name, weeksSince: null });
      continue;
    }

    const weeksSince = Math.floor(
      (now.getTime() - contact.lastContactAt.getTime()) / (7 * 86_400_000)
    );
    if (weeksSince >= contact.keepInTouchWeeks) {
      due.push({ id: contact.id, name: contact.name, weeksSince });
    }
  }

  // Wie het langst wacht, staat bovenaan
  return due.sort((a, b) => (b.weeksSince ?? 999) - (a.weeksSince ?? 999));
}

/** "Lisa wordt 34" of "Lisa is vandaag 34", afhankelijk van de dag. */
export function birthdayLine(entry: BirthdayEntry): string {
  const age = entry.age !== null ? ` ${entry.age}` : "";

  if (entry.inDays === 0) {
    return entry.age !== null
      ? `${entry.name} is vandaag${age}`
      : `${entry.name} is vandaag jarig`;
  }

  const when = entry.inDays === 1 ? "morgen" : `over ${entry.inDays} dagen`;
  return entry.age !== null
    ? `${entry.name} wordt${age} ${when}`
    : `${entry.name} is ${when} jarig`;
}
