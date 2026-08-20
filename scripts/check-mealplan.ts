/**
 * Regressiegevallen voor de weekmenu-invoer. Draaien met `npm run check:mealplan`.
 *
 * De maaltijdplanner zit achter de login, dus er is geen browsercheck mogelijk;
 * dit script is de enige manier om te zien dat de server het dagenraster van
 * Merel volgt in plaats van er eigen dagen bij te verzinnen. Dat ging eerder mis:
 * donderdag-restjes en vrijdag-frietjes stonden op zeven plekken hardcoded.
 *
 * Een dag niet aanvinken is nu de énige manier waarop Merel iets buiten het menu
 * houdt, dus daar staan de meeste gevallen op.
 */
import {
  buildSchedule,
  buildSystemPrompt,
  buildUserText,
  normaliseerMealprep,
  DAYS,
  type MealGrid,
  type PlanInput,
} from "@/lib/meal-plan-input";

function grid(avonden: string[], extra: Record<string, string[]> = {}): MealGrid {
  const g: MealGrid = {};
  for (const day of DAYS) {
    g[day] = {
      ontbijt: extra[day]?.includes("ontbijt") ?? false,
      lunch: extra[day]?.includes("lunch") ?? false,
      avondeten: avonden.includes(day),
    };
  }
  return g;
}

function plan(over: Partial<PlanInput>): PlanInput {
  return {
    mealGrid: grid([...DAYS]),
    mealprep: normaliseerMealprep(undefined),
    ...over,
  };
}

interface Check {
  naam: string;
  input: PlanInput;
  /** Moet in de prompt staan (systeem + gebruikerstekst samen). */
  bevat?: string[];
  /** Mag er absoluut niet in staan. */
  bevatNiet?: string[];
  aantalMaaltijden?: number;
  regels?: string[];
}

const checks: Check[] = [
  {
    naam: "alleen de aangevinkte avonden komen in de prompt",
    input: plan({ mealGrid: grid(["Maandag", "Donderdag", "Vrijdag"]) }),
    regels: ["Maandag: avondeten", "Donderdag: avondeten", "Vrijdag: avondeten"],
    aantalMaaltijden: 3,
    // Met dubbele punt: "Zondag" staat als voorbeelddag in het JSON-outputformaat
    bevatNiet: ["Dinsdag:", "Woensdag:", "Zaterdag:", "Zondag:", "staat vast"],
  },
  {
    naam: "een dag die niet is aangevinkt komt niet in de prompt",
    input: plan({ mealGrid: grid(["Maandag"]) }),
    regels: ["Maandag: avondeten"],
    aantalMaaltijden: 1,
    bevatNiet: ["Dinsdag:", "Woensdag:", "Zondag:"],
  },
  {
    naam: "vrijdag uitvinken (frietjesdag) haalt vrijdag helemaal uit de prompt",
    input: plan({ mealGrid: grid(DAYS.filter((d) => d !== "Vrijdag")) }),
    aantalMaaltijden: 6,
    bevat: ["Donderdag: avondeten", "Zaterdag: avondeten"],
    bevatNiet: ["Vrijdag"],
  },
  {
    naam: "een dagvoorkeur gaat alleen mee als die dag gepland is",
    input: plan({ mealGrid: grid(["Maandag"]) }),
    bevatNiet: ["Dinsdag: SNEL", "Zondag: prep-dag"],
  },
  {
    naam: "ontbijt en lunch worden apart gepland",
    input: plan({
      mealGrid: grid(["Maandag"], { Zondag: ["lunch"] }),
    }),
    regels: ["Maandag: avondeten", "Zondag: lunch"],
    aantalMaaltijden: 2,
  },
  {
    naam: "mealprep staat altijd aan: porties, kookmoment en bewaaradvies gevraagd",
    input: plan({ mealGrid: grid(["Maandag", "Dinsdag"]) }),
    bevat: [
      "MEALPREP-MODUS",
      `"porties"`,
      `"kookmoment"`,
      `"bewaaradvies"`,
      "MAXIMAAL 3 verschillende basisgerechten voor de 2 te plannen maaltijden",
      "4 porties per maaltijd",
    ],
  },
  {
    naam: "eigen mealprep-getallen komen in de noemer terug",
    input: plan({
      mealGrid: grid(["Maandag", "Dinsdag", "Woensdag", "Zaterdag", "Zondag"]),
      mealprep: normaliseerMealprep({ aantalGerechten: 3, porties: 5 }),
    }),
    aantalMaaltijden: 5,
    bevat: [
      "MAXIMAAL 3 verschillende basisgerechten voor de 5 te plannen maaltijden",
      "5 porties per maaltijd",
      "maximaal 3 verschillende gerechten voor 5 te plannen maaltijden",
    ],
  },
  {
    naam: "rare getallen worden rechtgetrokken",
    input: plan({
      mealprep: normaliseerMealprep({ aantalGerechten: 0, porties: -2 }),
    }),
    bevat: ["MAXIMAAL 1 verschillende basisgerechten", "1 porties per maaltijd"],
  },
  {
    naam: "niets aangevinkt levert een leeg schema (de route geeft dan een fout)",
    input: plan({ mealGrid: grid([]) }),
    regels: [],
    aantalMaaltijden: 0,
  },
];

let failed = 0;
for (const check of checks) {
  const schedule = buildSchedule(check.input);
  const prompt =
    buildSystemPrompt(check.input, schedule) + "\n" + buildUserText(check.input, schedule);
  const fouten: string[] = [];

  if (check.regels) {
    if (JSON.stringify(schedule.regels) !== JSON.stringify(check.regels)) {
      fouten.push(
        `regels: verwacht ${JSON.stringify(check.regels)}, kreeg ${JSON.stringify(schedule.regels)}`
      );
    }
  }
  if (check.aantalMaaltijden !== undefined && schedule.aantalMaaltijden !== check.aantalMaaltijden) {
    fouten.push(
      `aantalMaaltijden: verwacht ${check.aantalMaaltijden}, kreeg ${schedule.aantalMaaltijden}`
    );
  }
  for (const stuk of check.bevat ?? []) {
    if (!prompt.includes(stuk)) fouten.push(`mist in de prompt: ${JSON.stringify(stuk)}`);
  }
  for (const stuk of check.bevatNiet ?? []) {
    if (prompt.includes(stuk)) fouten.push(`staat er wel in: ${JSON.stringify(stuk)}`);
  }

  if (fouten.length > 0) {
    failed++;
    console.log(`FAIL  ${check.naam}`);
    for (const fout of fouten) console.log(`        ${fout}`);
  } else {
    console.log(`ok    ${check.naam}`);
  }
}

if (failed === 0) {
  console.log(`\nalle ${checks.length} gevallen goed`);
} else {
  console.log(`\n${failed} van ${checks.length} fout`);
  process.exitCode = 1;
}
