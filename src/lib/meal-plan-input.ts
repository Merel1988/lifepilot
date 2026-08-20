/**
 * Alles wat de invoer van de maaltijdplanner omzet naar een prompt.
 *
 * Staat los van de route zodat het puur en zonder database te testen is
 * (`npm run check:mealplan`) — de route zelf kan niet in een test, want die
 * praat met Turso en met de Anthropic API. Hier zit geen enkele aanname over
 * welke dag wat eet: dat komt allemaal uit `PlanInput`.
 */

export const DAYS = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
] as const;

export type MealGrid = Record<string, Record<string, boolean>>;

/**
 * Mealprep: minder verschillende gerechten voor meer dagen. Staat altijd aan —
 * wie geen menu wil voor een dag vinkt die dag simpelweg niet aan.
 */
export interface Mealprep {
  aantalGerechten: number;
  porties: number;
}

export interface PlanInput {
  mealGrid: MealGrid;
  mealprep: Mealprep;
  ahBonus?: string;
  persoonlijkeBonus?: string;
  voorraad?: string;
  recipes?: { title: string; category: string; ingredients: string | null }[];
}

export interface PlanSchedule {
  /** Regels als "Maandag: avondeten" voor de prompt. */
  regels: string[];
  /** Aantal maaltijden dat het model moet bedenken. */
  aantalMaaltijden: number;
  /** Dagen waarop iets anders dan avondeten is gevraagd: daar valt het prepwerk. */
  prepDagen: string[];
  /** Elke te plannen combinatie als "Dag|maaltijd". */
  gepland: string[];
}

const DIEET = `Je bent een persoonlijke weekmenu-assistent voor een Nederlandse moeder met een kind van 1,5 jaar.

DIEET:
- Zo min mogelijk suiker en omega-6
- Weinig bewerkt voedsel
- Minder brood/koolhydraten (maar niet strict keto - pasta af en toe is prima als uitzondering)
- Grasgevoerd rundvlees (heeft een koe van Grutto - gehakt, bavette, biefstuk)
- Veel zalm en tonijn, af en toe kipfilet
- Kwark en kaas zijn goed

PEUTER-REGELS:
- Geen pittig eten
- Wel: pasta, rijst, noedels, pindasaus (mild), zachte groenten

COURGETTE:
- Nooit alleen courgette in de pan - altijd met: grillpan + citroen + knoflook + feta + pijnboompitten, OF als courgetti met pesto, OF geroosterd in oven

GEBRUIK BONUSARTIKELEN: Verwerk AH bonus-items slim in het menu. Als er favoriete recepten zijn waarvan ingrediënten in de bonus zijn, gebruik die recepten dan! Dure bonus-items zijn een goede reden om een favoriet recept in te plannen.

BELANGRIJK: Plan ALLEEN maaltijden voor de dag/maaltijdcombinaties die in de input staan. Als alleen "avondeten" op maandag is aangevinkt, geef dan alleen het avondeten voor maandag. Verzin geen extra dagen.

Als er foto's van de voorraad/koelkast zijn bijgevoegd, analyseer dan wat je ziet en gebruik het slim in het menu.`;

/**
 * Voorkeuren die aan één dag hangen. Ze gaan alleen mee als die dag deze week
 * ook echt te plannen is — anders leest het model regels over dagen die niet
 * bestaan, en dat leverde eerder maaltijden op die niemand had aangevinkt.
 */
const DAG_VOORKEUREN: { dag: string; maaltijd: string; regel: string }[] = [
  {
    dag: "Dinsdag",
    maaltijd: "avondeten",
    regel: "Dinsdag: SNEL - max 20 minuten, liefst oven-gerecht of iets uit de vriezer",
  },
  {
    dag: "Zondag",
    maaltijd: "avondeten",
    regel:
      "Zondag: prep-dag, handen-vrij gerecht (oven/slowcooker), zomers van karakter (geen zware stoofpot)",
  },
  {
    dag: "Zondag",
    maaltijd: "lunch",
    regel:
      "Zondaglunch preppen in max 30 min, geen soep (uitzondering: maïs-aardappel-garnalen soep)",
  },
];

/** De badges die een dag kan krijgen. */
const BADGES = ["snel", "bonus", "prep", "favoriet"];

/** Wat een dag/maaltijd-combinatie identificeert. */
function claimKey(dag: string, maaltijd: string): string {
  return `${dag}|${maaltijd}`;
}

/** Een getal uit de invoer, of het standaardgetal als het onbruikbaar is. */
function getal(raw: unknown, standaard: number): number {
  const n = Number(raw);
  // `|| standaard` stond hier eerst, maar 0 is falsy: dat werd 3 in plaats van 1
  if (!Number.isFinite(n)) return standaard;
  return Math.max(1, Math.round(n));
}

export function normaliseerMealprep(raw: Partial<Mealprep> | undefined): Mealprep {
  return {
    aantalGerechten: getal(raw?.aantalGerechten, 3),
    porties: getal(raw?.porties, 4),
  };
}

export function buildSchedule(input: PlanInput): PlanSchedule {
  const regels: string[] = [];
  const prepDagen: string[] = [];
  const gepland: string[] = [];
  let aantalMaaltijden = 0;

  for (const day of DAYS) {
    const meals = input.mealGrid?.[day] ?? {};
    const aan = Object.entries(meals)
      .filter(([, on]) => on)
      .map(([meal]) => meal);

    aantalMaaltijden += aan.length;
    for (const meal of aan) gepland.push(claimKey(day, meal));
    if (aan.some((meal) => meal !== "avondeten")) prepDagen.push(day);

    if (aan.length > 0) regels.push(`${day}: ${aan.join(", ")}`);
  }

  return { regels, aantalMaaltijden, prepDagen, gepland };
}

function mealprepRules(mealprep: Mealprep, aantalMaaltijden: number): string {
  return `\n\nMEALPREP-MODUS:
Maak MAXIMAAL ${mealprep.aantalGerechten} verschillende basisgerechten voor de ${aantalMaaltijden} te plannen maaltijden. Hetzelfde gerecht mag dus meerdere dagen terugkomen — dat is de bedoeling, geen fout.
- Reken met ${mealprep.porties} porties per maaltijd. Zet bij elk gerecht hoeveel porties je in één keer maakt.
- Varieer binnen hetzelfde basisgerecht zodat het niet als opgewarmde restjes voelt: andere groente, andere saus, warm of koud, in een wrap of op een bord. Beschrijf die variatie in de notitie.
- Zet bij elke dag een kookmoment: "koken" (je maakt het die dag), "opwarmen" (uit de koelkast), "ontdooien" (uit de vriezer) of "koud" (direct eten).
- Zet bij elke dag bewaaradvies: hoe lang het goed blijft en of het de koelkast of de vriezer in moet.
- Bundel het koken op zo min mogelijk dagen en laat de rest opwarmen.`;
}

function outputFormat(prepDagen: string[]): string {
  const dagVelden = [
    `      "dag": "Maandag"`,
    `      "type": "avondeten"`,
    `      "maaltijd": "naam van het gerecht"`,
    `      "notitie": "korte bereidingstip (max 2 zinnen)"`,
    `      "badge": "een van: ${[...BADGES, "null"].join(" | ")}"`,
    `      "bonus_item": true of false`,
    `      "porties": aantal porties dat je die dag maakt (getal)`,
    `      "kookmoment": "koken | opwarmen | ontdooien | koud"`,
    `      "bewaaradvies": "hoe lang en waar het goed blijft"`,
  ];

  const prepUitleg =
    prepDagen.length > 0
      ? `De prep-stappen horen bij ${prepDagen.join(" en ")}.`
      : `Zet de prep-stappen op de dag waarop het meeste kookwerk valt.`;

  return `\n\nOUTPUTFORMAAT - Geef ALLEEN geldige JSON terug, geen andere tekst, geen markdown backticks:
{
  "week_titel": "korte beschrijving van dit menu",
  "dagen": [
    {
${dagVelden.join(",\n")}
    }
  ],
  "prep": [
    {
      "dag": "Zondag",
      "stappen": ["stap 1", "stap 2"]
    }
  ],
  "boodschappenlijst": [
    "item 1",
    "item 2"
  ]
}

${prepUitleg}`;
}

export function buildSystemPrompt(input: PlanInput, schedule: PlanSchedule): string {
  // Prep hoort op een dag die ook echt gepland is; zondag heeft voorrang omdat
  // dat het prep-moment uit de voorkeuren is.
  const prepDagen = schedule.prepDagen.includes("Zondag")
    ? ["Zondag"]
    : schedule.prepDagen.slice(0, 1);

  const geplandeSet = new Set(schedule.gepland);
  const voorkeuren = DAG_VOORKEUREN.filter((v) =>
    geplandeSet.has(claimKey(v.dag, v.maaltijd))
  ).map((v) => `- ${v.regel}`);
  const voorkeurenBlok =
    voorkeuren.length > 0 ? `\n\nVOORKEUREN VOOR DEZE DAGEN:\n${voorkeuren.join("\n")}` : "";

  return (
    DIEET +
    voorkeurenBlok +
    mealprepRules(input.mealprep, schedule.aantalMaaltijden) +
    outputFormat(prepDagen)
  );
}

export function buildUserText(input: PlanInput, schedule: PlanSchedule): string {
  let recipesContext = "";
  if (input.recipes && input.recipes.length > 0) {
    const recipeLines = input.recipes.map((r) => {
      let line = `- ${r.title} (${r.category})`;
      if (r.ingredients) line += ` — ingrediënten: ${r.ingredients}`;
      return line;
    });
    recipesContext = `\n\nFAVORIETE RECEPTEN (gebruik deze als ingrediënten in de bonus zijn of als ze goed passen):\n${recipeLines.join("\n")}`;
  }

  const mealprepRegel = `\n\nIk wil mealpreppen: maximaal ${input.mealprep.aantalGerechten} verschillende gerechten voor ${schedule.aantalMaaltijden} te plannen maaltijden, ${input.mealprep.porties} porties per maaltijd.`;

  return `Maak een weekmenu voor mij met de volgende input:

TE PLANNEN MAALTIJDEN:
${schedule.regels.join("\n")}

AH BONUSAANBIEDINGEN:
${input.ahBonus || "Geen opgegeven"}

PERSOONLIJKE BONUSAANBIEDINGEN:
${input.persoonlijkeBonus || "Geen opgegeven"}

WAT IK AL IN HUIS HEB:
${input.voorraad || "Standaard voorraad"}${recipesContext}

Plan ALLEEN de hierboven genoemde dag/maaltijd combinaties. Verwerk bonus slim.${mealprepRegel}`;
}
