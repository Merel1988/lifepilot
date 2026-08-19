/**
 * Regressiegevallen voor het dumpveld. Draaien met `npm run check:parse`.
 *
 * De app heeft geen testrunner; dit script is er omdat de parser gokt en een
 * verkeerde gok stil doorwerkt in de data. Zet er een geval bij zodra je een
 * nieuwe formulering toevoegt of iets fout ziet gaan.
 */
import { parseQuickInput } from "@/lib/parse-input";

const TODAY = "2026-08-19"; // een woensdag

type Expect = Partial<{
  title: string;
  type: string;
  date: string | null;
  time: string | null;
  folder: string | null;
  recurring: boolean;
  recurrenceDays: number[];
}>;

const cases: [string, Expect][] = [
  ["morgen 9u tandarts", { title: "Tandarts", type: "REMINDER", date: "2026-08-20", time: "09:00" }],
  ["tandarts morgen om 9", { title: "Tandarts", type: "REMINDER", date: "2026-08-20", time: "09:00" }],
  ["vrijdag boodschappen doen", { title: "Boodschappen doen", type: "TASK", date: "2026-08-21", time: null }],
  ["woensdag afval", { title: "Afval", date: "2026-08-19" }],
  ["volgende week maandag naar de garage", { title: "Naar de garage", date: "2026-08-31" }],
  ["over 3 dagen bellen met de bank", { title: "Bellen met de bank", date: "2026-08-22" }],
  ["over een week terugbellen", { title: "Terugbellen", date: "2026-08-26" }],
  ["15 september verjaardag oma", { title: "Verjaardag oma", date: "2026-09-15" }],
  ["3 jan tandarts bellen", { title: "Tandarts bellen", date: "2027-01-03" }],
  ["15-9 apk", { title: "Apk", date: "2026-09-15" }],
  ["31/12/2026 vuurwerk", { title: "Vuurwerk", date: "2026-12-31" }],
  ["elke maandag afval buiten zetten", { title: "Afval buiten zetten", recurring: true, recurrenceDays: [1], date: null }],
  ["elke dag pillen 8u", { title: "Pillen", recurring: true, recurrenceDays: [0, 1, 2, 3, 4, 5, 6], time: "08:00", type: "REMINDER" }],
  ["iedere werkdag standup 9:15", { title: "Standup", recurring: true, recurrenceDays: [1, 2, 3, 4, 5], time: "09:15", folder: "WERK" }],
  ["elke di en do sporten", { title: "Sporten", recurring: true, recurrenceDays: [2, 4] }],
  ["notitie: idee voor cadeau mama", { title: "Idee voor cadeau mama", type: "NOTE", date: null, time: null }],
  ["vanavond 8u film kijken", { title: "Film kijken", date: "2026-08-19", time: "20:00" }],
  ["morgenochtend 6u opstaan", { title: "Opstaan", date: "2026-08-20", time: "06:00" }],
  ["half 10 vergadering", { title: "Vergadering", time: "09:30", folder: "WERK" }],
  ["kwart voor 8 trein", { title: "Trein", time: "19:45" }],
  ["kwart over 8 's ochtends trein", { title: "Trein", time: "08:15" }],
  ["6u tandarts", { time: "18:00" }],
  ["19u30 eten", { title: "Eten", time: "19:30" }],
  ["overleg met jannie meppel donderdag", { title: "Overleg met jannie meppel", folder: "JANNIE_MEPPEL", date: "2026-08-20" }],
  ["lampen kopen #werk", { title: "Lampen kopen", folder: "WERK" }],
  ["kat naar de dierenarts", { title: "Kat naar de dierenarts", date: null, folder: null, type: "TASK" }],
  ["3 eieren kopen", { title: "3 eieren kopen", date: null, time: null }],
  ["vandaag nog de was doen", { title: "Nog de was doen", date: "2026-08-19" }],
  ["", { title: "" }],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = parseQuickInput(input, { today: TODAY }) as unknown as Record<string, unknown>;
  const wrong = Object.entries(expected).filter(([key, value]) => {
    const actual = got[key];
    return Array.isArray(value)
      ? JSON.stringify(actual) !== JSON.stringify(value)
      : actual !== value;
  });
  if (wrong.length > 0) {
    failed++;
    console.log(`FAIL  "${input}"`);
    for (const [key, value] of wrong) {
      console.log(`        ${key}: verwacht ${JSON.stringify(value)}, kreeg ${JSON.stringify(got[key])}`);
    }
    console.log(`        volledig: ${JSON.stringify(got)}`);
  } else {
    console.log(`ok    "${input}" -> ${JSON.stringify({ title: got.title, type: got.type, date: got.date, time: got.time, folder: got.folder, days: got.recurrenceDays })}`);
  }
}
if (failed === 0) {
  console.log(`\nalle ${cases.length} gevallen goed`);
} else {
  console.log(`\n${failed} van ${cases.length} fout`);
  process.exitCode = 1;
}
