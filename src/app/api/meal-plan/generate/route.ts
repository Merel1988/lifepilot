import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `Je bent een persoonlijke weekmenu-assistent voor een Nederlandse moeder met een kind van 1,5 jaar.

DIEET:
- Zo min mogelijk suiker en omega-6
- Weinig bewerkt voedsel
- Minder brood/koolhydraten (maar niet strict keto - pasta af en toe is prima als uitzondering)
- Grasgevoerd rundvlees (heeft een koe van Grutto - gehakt, bavette, biefstuk)
- Veel zalm en tonijn, af en toe kipfilet
- Kwark en kaas zijn goed
- Zondag: lunch preppen in max 30 min, geen soep (uitzondering: maïs-aardappel-garnalen soep)

VASTE STRUCTUUR:
- Donderdag: RESTJESDAG — plan hier NIETS, geef alleen badge "restjes" en maaltijd "Restjes van de week"
- Vrijdag: ALTIJD frietjes — nooit veranderen, badge "frietjes"
- Dinsdag: SNEL - max 20 minuten, liefst oven-gerecht of iets uit de vriezer
- Zondag: prep-dag, handen-vrij gerecht (oven/slowcooker), zomers van karakter (geen zware stoofpot)

PEUTER-REGELS:
- Geen pittig eten
- Wel: pasta, rijst, noedels, pindasaus (mild), zachte groenten

COURGETTE:
- Nooit alleen courgette in de pan - altijd met: grillpan + citroen + knoflook + feta + pijnboompitten, OF als courgetti met pesto, OF geroosterd in oven

GEBRUIK BONUSARTIKELEN: Verwerk AH bonus-items slim in het menu. Als er favoriete recepten zijn waarvan ingrediënten in de bonus zijn, gebruik die recepten dan! Dure bonus-items zijn een goede reden om een favoriet recept in te plannen.

BELANGRIJK: Plan ALLEEN maaltijden voor de dag/maaltijdcombinaties die in de input staan. Als alleen "avondeten" op maandag is aangevinkt, geef dan alleen het avondeten voor maandag.

Als er foto's van de voorraad/koelkast zijn bijgevoegd, analyseer dan wat je ziet en gebruik het slim in het menu.

OUTPUTFORMAAT - Geef ALLEEN geldige JSON terug, geen andere tekst, geen markdown backticks:
{
  "week_titel": "korte beschrijving van dit menu",
  "dagen": [
    {
      "dag": "Maandag",
      "type": "avondeten",
      "maaltijd": "naam van het gerecht",
      "notitie": "korte bereidingstip (max 2 zinnen)",
      "badge": "een van: snel | frietjes | bonus | prep | restjes | favoriet | null",
      "bonus_item": true of false
    }
  ],
  "zondag_prep": [
    "stap 1 voor de lunch-prep van zondag",
    "stap 2"
  ],
  "boodschappenlijst": [
    "item 1",
    "item 2"
  ]
}

Donderdag avondeten is ALTIJD: { "dag": "Donderdag", "type": "avondeten", "maaltijd": "Restjes van de week", "badge": "restjes", "bonus_item": false }
Vrijdag avondeten is ALTIJD: { "dag": "Vrijdag", "type": "avondeten", "maaltijd": "Frietjes", "notitie": "Met snack naar keuze", "badge": "frietjes", "bonus_item": false }`;

interface MealGrid {
  [day: string]: { [meal: string]: boolean };
}

interface PhotoData {
  base64: string;
  mediaType: string;
}

interface RecipeInput {
  title: string;
  category: string;
  ingredients: string | null;
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const {
    ahBonus,
    persoonlijkeBonus,
    voorraad,
    mealGrid,
    photos,
    recipes,
  }: {
    ahBonus: string;
    persoonlijkeBonus: string;
    voorraad: string;
    mealGrid: MealGrid;
    photos: PhotoData[];
    recipes: RecipeInput[];
  } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY niet geconfigureerd. Voeg deze toe aan je .env bestand." },
      { status: 500 }
    );
  }

  // Build the meal schedule description from the grid
  const mealSchedule: string[] = [];
  const days = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
  for (const day of days) {
    const meals = mealGrid[day];
    if (!meals) continue;
    const activeMeals = Object.entries(meals)
      .filter(([, on]) => on)
      .map(([meal]) => meal);
    if (day === "Donderdag") activeMeals.push("avondeten (restjesdag)");
    if (day === "Vrijdag") activeMeals.push("avondeten (frietjesdag)");
    if (activeMeals.length > 0) {
      mealSchedule.push(`${day}: ${activeMeals.join(", ")}`);
    }
  }

  // Build recipes context
  let recipesContext = "";
  if (recipes && recipes.length > 0) {
    const recipeLines = recipes.map((r) => {
      let line = `- ${r.title} (${r.category})`;
      if (r.ingredients) line += ` — ingrediënten: ${r.ingredients}`;
      return line;
    });
    recipesContext = `\n\nFAVORIETE RECEPTEN (gebruik deze als ingrediënten in de bonus zijn of als ze goed passen):\n${recipeLines.join("\n")}`;
  }

  // Build user message content blocks
  const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [];

  // Add photos first if any
  if (photos && photos.length > 0) {
    for (const photo of photos) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: photo.mediaType,
          data: photo.base64,
        },
      });
    }
    contentBlocks.push({
      type: "text",
      text: "Hierboven zie je foto's van mijn voorraadkast/koelkast. Analyseer wat je ziet en gebruik het in het weekmenu.\n\n",
    });
  }

  const userText = `Maak een weekmenu voor mij met de volgende input:

TE PLANNEN MAALTIJDEN:
${mealSchedule.join("\n")}

AH BONUSAANBIEDINGEN:
${ahBonus || "Geen opgegeven"}

PERSOONLIJKE BONUSAANBIEDINGEN:
${persoonlijkeBonus || "Geen opgegeven"}

WAT IK AL IN HUIS HEB:
${voorraad || "Standaard voorraad"}${recipesContext}

Plan ALLEEN de hierboven genoemde dag/maaltijd combinaties. Donderdag avondeten = restjesdag. Vrijdag avondeten = frietjesdag. Verwerk bonus slim.`;

  contentBlocks.push({ type: "text", text: userText });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return Response.json(
        { error: `API fout (${response.status}): ${errBody}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Save the plan
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = monday.toISOString().split("T")[0];

    await prisma.mealPlan.create({
      data: {
        weekStart,
        data: JSON.stringify(parsed),
      },
    });

    return Response.json(parsed);
  } catch {
    return Response.json(
      { error: "Er ging iets mis bij het genereren van het menu." },
      { status: 500 }
    );
  }
}
