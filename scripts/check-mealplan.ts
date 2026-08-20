/**
 * Regressiegevallen voor de weekmenu-invoer. Draaien met `npm run check:mealplan`.
 *
 * De maaltijdplanner zit achter de login, dus er is geen browsercheck mogelijk;
 * dit script is de enige manier om te zien dat de server het dagenraster van
 * Merel volgt in plaats van er eigen dagen bij te verzinnen. Dat ging eerder mis:
 * donderdag-restjes en vrijdag-frietjes stonden op zeven plekken hardcoded.
 */
import {
  buildSchedule,
  buildSystemPrompt,
  buildUserText,
  normaliseerMealprep,
  DAYS,
  type Gewoonte,
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

const RESTJES: Gewoonte = {
  dag: "Donderdag",
  maaltijd: "avondeten",
  gerecht: "Restjes van de week",
  badge: "restjes",
};
const FRIETJES: Gewoonte = {
  dag: "Vrijdag",
  maaltijd: "avondeten",
  gerecht: "Frietjes",
  notitie: "Met snack naar keuze",
  badge: "frietjes",
};

function plan(over: Partial<PlanInput>): PlanInput {
  return {
    mealGrid: grid([...DAYS]),
    gewoontes: [],
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
    naam: "geen gewoontes: geen enkele dag staat vast",
    input: plan({ mealGrid: grid(["Maandag", "Donderdag", "Vrijdag"]) }),
    regels: ["Maandag: avondeten", "Donderdag: avondeten", "Vrijdag: avondeten"],
    aantalMaaltijden: 3,
    bevat: ["Er staan deze week geen vaste dagen"],
    bevatNiet: ["restjes", "Frietjes", "staat vast"],
  },
  {
    naam: "gewoontes aan: die dagen staan vast en tellen niet mee als te plannen",
    input: plan({
      mealGrid: grid(["Maandag", "Donderdag", "Vrijdag"]),
      gewoontes: [RESTJES, FRIETJES],
    }),
    regels: [
      "Maandag: avondeten",
      "Donderdag: avondeten (staat vast: Restjes van de week)",
      "Vrijdag: avondeten (staat vast: Frietjes)",
    ],
    aantalMaaltijden: 1,
    bevat: ["Donderdag avondeten = Restjes van de week", "Vrijdag avondeten = Frietjes"],
  },
  {
    naam: "gewoonte op een andere dag: frietjes op zaterdag",
    input: plan({
      mealGrid: grid(["Vrijdag", "Zaterdag"]),
      gewoontes: [{ ...FRIETJES, dag: "Zaterdag" }],
    }),
    regels: ["Vrijdag: avondeten", "Zaterdag: avondeten (staat vast: Frietjes)"],
    aantalMaaltijden: 1,
    bevatNiet: ["Vrijdag avondeten = Frietjes"],
  },
  {
    naam: "een dag die niet is aangevinkt komt niet in de prompt",
    input: plan({ mealGrid: grid(["Maandag"]) }),
    regels: ["Maandag: avondeten"],
    aantalMaaltijden: 1,
    bevatNiet: ["Dinsdag:", "Woensdag:", "Zondag:"],
  },
  {
    naam: "een gewoonte op een dag zonder vinkje staat er alleen als vaste dag",
    input: plan({ mealGrid: grid(["Maandag"]), gewoontes: [RESTJES] }),
    regels: ["Maandag: avondeten", "Donderdag: avondeten (staat vast: Restjes van de week)"],
    aantalMaaltijden: 1,
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
    naam: "mealprep uit: geen porties, kookmoment of bewaaradvies gevraagd",
    input: plan({ mealGrid: grid(["Maandag", "Dinsdag"]) }),
    bevatNiet: ["MEALPREP-MODUS", "kookmoment", "bewaaradvies", "porties"],
  },
  {
    naam: "mealprep aan: noemer en extra velden staan in de prompt",
    input: plan({
      mealGrid: grid(["Maandag", "Dinsdag", "Woensdag", "Zaterdag", "Zondag"]),
      mealprep: normaliseerMealprep({ aan: true, aantalGerechten: 3, porties: 5 }),
    }),
    aantalMaaltijden: 5,
    bevat: [
      "MEALPREP-MODUS",
      "MAXIMAAL 3 verschillende basisgerechten voor de 5 te plannen maaltijden",
      "5 porties per maaltijd",
      `"kookmoment"`,
      `"bewaaradvies"`,
      "maximaal 3 verschillende gerechten voor 5 te plannen maaltijden",
    ],
  },
  {
    naam: "rare getallen worden rechtgetrokken",
    input: plan({
      mealprep: normaliseerMealprep({ aan: true, aantalGerechten: 0, porties: -2 }),
    }),
    bevat: ["MAXIMAAL 1 verschillende basisgerechten"],
  },
  {
    naam: "een gewoonte met een onbekende dag wordt genegeerd",
    input: plan({
      mealGrid: grid(["Maandag"]),
      gewoontes: [{ ...RESTJES, dag: "Maandagavond" }],
    }),
    regels: ["Maandag: avondeten"],
    bevat: ["Er staan deze week geen vaste dagen"],
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
