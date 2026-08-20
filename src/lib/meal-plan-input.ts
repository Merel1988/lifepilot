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
 * Een dag die altijd hetzelfde eet — restjes, frietjes. Geen wet: de UI stuurt
 * alleen de gewoontes mee die deze week aanstaan, met de dag die Merel koos.
 * Een lege lijst betekent: plan elke dag vrij.
 */
export interface Gewoonte {
  dag: string;
  maaltijd: string;
  gerecht: string;
  notitie?: string | null;
  badge?: string | null;
}

/** Mealprep: minder verschillende gerechten voor meer dagen. */
export interface Mealprep {
  aan: boolean;
  aantalGerechten: number;
  porties: number;
}

export interface PlanInput {
  mealGrid: MealGrid;
  gewoontes: Gewoonte[];
  mealprep: Mealprep;
  ahBonus?: string;
  persoonlijkeBonus?: string;
  voorraad?: string;
  recipes?: { title: string; category: string; ingredients: string | null }[];
}

export interface PlanSchedule {
  /** Regels als "Maandag: avondeten" voor de prompt. */
  regels: string[];
  /** Aantal maaltijden dat het model zelf moet bedenken (zonder de vaste dagen). */
  aantalMaaltijden: number;
  /** De gewoontes die deze week echt meedoen. */
  vasteDagen: Gewoonte[];
  /** Dagen waarop iets anders dan avondeten is gevraagd: daar valt het prepwerk. */
  prepDagen: string[];
  /** Elke vrij te plannen combinatie als "Dag|maaltijd". */
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

/** Badges die altijd kunnen. Restjes en frietjes komen van de gewoontes zelf. */
const BASIS_BADGES = ["snel", "bonus", "prep", "favoriet"];

/** Wat een gewoonte precies bezet houdt: dag én maaltijd. */
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
    aan: raw?.aan === true,
    aantalGerechten: getal(raw?.aantalGerechten, 3),
    porties: getal(raw?.porties, 4),
  };
}

export function buildSchedule(input: PlanInput): PlanSchedule {
  const vasteDagen = (input.gewoontes ?? []).filter(
    (g) => g && g.dag && g.maaltijd && g.gerecht && DAYS.includes(g.dag as (typeof DAYS)[number])
  );
  const geclaimd = new Set(vasteDagen.map((g) => claimKey(g.dag, g.maaltijd)));

  const regels: string[] = [];
  const prepDagen: string[] = [];
  const gepland: string[] = [];
  let aantalMaaltijden = 0;

  for (const day of DAYS) {
    const meals = input.mealGrid?.[day] ?? {};
    const vrij = Object.entries(meals)
      .filter(([meal, on]) => on && !geclaimd.has(claimKey(day, meal)))
      .map(([meal]) => meal);
    const vast = vasteDagen
      .filter((g) => g.dag === day)
      .map((g) => `${g.maaltijd} (staat vast: ${g.gerecht})`);

    aantalMaaltijden += vrij.length;
    for (const meal of vrij) gepland.push(claimKey(day, meal));
    if (vrij.some((meal) => meal !== "avondeten")) prepDagen.push(day);

    const alles = [...vrij, ...vast];
    if (alles.length > 0) regels.push(`${day}: ${alles.join(", ")}`);
  }

  return { regels, aantalMaaltijden, vasteDagen, prepDagen, gepland };
}

/** Regels voor de dagen die deze week vaststaan, of het tegendeel als er geen zijn. */
function gewoonteRules(vasteDagen: Gewoonte[]): string {
  if (vasteDagen.length === 0) {
    return `\n\nEr staan deze week geen vaste dagen. Plan elke genoemde dag vrij in.`;
  }

  const lines = vasteDagen.map((g) => {
    const entry = JSON.stringify({
      dag: g.dag,
      type: g.maaltijd,
      maaltijd: g.gerecht,
      ...(g.notitie ? { notitie: g.notitie } : {}),
      badge: g.badge ?? null,
      bonus_item: false,
    });
    return `- ${g.dag} ${g.maaltijd} staat vast: geef exact ${entry} en plan hier zelf niets bij.`;
  });

  return `\n\nVASTE DAGEN DEZE WEEK (door mij gekozen, niet aan veranderen):\n${lines.join("\n")}`;
}

function mealprepRules(mealprep: Mealprep, aantalMaaltijden: number): string {
  if (!mealprep.aan) return "";

  return `\n\nMEALPREP-MODUS:
Maak MAXIMAAL ${mealprep.aantalGerechten} verschillende basisgerechten voor de ${aantalMaaltijden} te plannen maaltijden. Hetzelfde gerecht mag dus meerdere dagen terugkomen — dat is de bedoeling, geen fout.
- Reken met ${mealprep.porties} porties per maaltijd. Zet bij elk gerecht hoeveel porties je in één keer maakt.
- Varieer binnen hetzelfde basisgerecht zodat het niet als opgewarmde restjes voelt: andere groente, andere saus, warm of koud, in een wrap of op een bord. Beschrijf die variatie in de notitie.
- Zet bij elke dag een kookmoment: "koken" (je maakt het die dag), "opwarmen" (uit de koelkast), "ontdooien" (uit de vriezer) of "koud" (direct eten).
- Zet bij elke dag bewaaradvies: hoe lang het goed blijft en of het de koelkast of de vriezer in moet.
- Bundel het koken op zo min mogelijk dagen en laat de rest opwarmen.`;
}

function outputFormat(mealprep: Mealprep, prepDagen: string[], badges: string[]): string {
  const dagVelden = [
    `      "dag": "Maandag"`,
    `      "type": "avondeten"`,
    `      "maaltijd": "naam van het gerecht"`,
    `      "notitie": "korte bereidingstip (max 2 zinnen)"`,
    `      "badge": "een van: ${[...badges, "null"].join(" | ")}"`,
    `      "bonus_item": true of false`,
  ];

  if (mealprep.aan) {
    dagVelden.push(
      `      "porties": aantal porties dat je die dag maakt (getal)`,
      `      "kookmoment": "koken | opwarmen | ontdooien | koud"`,
      `      "bewaaradvies": "hoe lang en waar het goed blijft"`
    );
  }

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

  const badges = [
    ...BASIS_BADGES,
    ...schedule.vasteDagen.map((g) => g.badge).filter((b): b is string => Boolean(b)),
  ].filter((b, i, all) => all.indexOf(b) === i);

  return (
    DIEET +
    voorkeurenBlok +
    gewoonteRules(schedule.vasteDagen) +
    mealprepRules(input.mealprep, schedule.aantalMaaltijden) +
    outputFormat(input.mealprep, prepDagen, badges)
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

  const vasteRegel =
    schedule.vasteDagen.length > 0
      ? `\n\nDeze dagen staan vast en houd je zo: ${schedule.vasteDagen
          .map((g) => `${g.dag} ${g.maaltijd} = ${g.gerecht}`)
          .join("; ")}.`
      : "";

  const mealprepRegel = input.mealprep.aan
    ? `\n\nIk wil mealpreppen: maximaal ${input.mealprep.aantalGerechten} verschillende gerechten voor ${schedule.aantalMaaltijden} te plannen maaltijden, ${input.mealprep.porties} porties per maaltijd.`
    : "";

  return `Maak een weekmenu voor mij met de volgende input:

TE PLANNEN MAALTIJDEN:
${schedule.regels.join("\n")}

AH BONUSAANBIEDINGEN:
${input.ahBonus || "Geen opgegeven"}

PERSOONLIJKE BONUSAANBIEDINGEN:
${input.persoonlijkeBonus || "Geen opgegeven"}

WAT IK AL IN HUIS HEB:
${input.voorraad || "Standaard voorraad"}${recipesContext}

Plan ALLEEN de hierboven genoemde dag/maaltijd combinaties. Verwerk bonus slim.${vasteRegel}${mealprepRegel}`;
}
