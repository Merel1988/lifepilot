import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import {
  buildSchedule,
  buildSystemPrompt,
  buildUserText,
  normaliseerMealprep,
  type Gewoonte,
  type MealGrid,
  type Mealprep,
  type PlanInput,
} from "@/lib/meal-plan-input";
import { NextRequest } from "next/server";

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
    gewoontes,
    mealprep,
    photos,
    recipes,
    instellingen,
  }: {
    ahBonus: string;
    persoonlijkeBonus: string;
    voorraad: string;
    mealGrid: MealGrid;
    gewoontes?: Gewoonte[];
    mealprep?: Partial<Mealprep>;
    photos: PhotoData[];
    recipes: RecipeInput[];
    instellingen?: unknown;
  } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY niet geconfigureerd. Voeg deze toe aan je .env bestand." },
      { status: 500 }
    );
  }

  // Niets aan het menu staat hier vast: welke dagen, welke gewoontes en of het
  // een mealprep-week is komt allemaal uit het verzoek.
  const input: PlanInput = {
    mealGrid: mealGrid ?? {},
    gewoontes: gewoontes ?? [],
    mealprep: normaliseerMealprep(mealprep),
    ahBonus,
    persoonlijkeBonus,
    voorraad,
    recipes,
  };
  const schedule = buildSchedule(input);

  if (schedule.regels.length === 0) {
    return Response.json(
      { error: "Geen maaltijden geselecteerd. Vink minstens één dag aan." },
      { status: 400 }
    );
  }

  // Build user message content blocks
  const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [];

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

  contentBlocks.push({ type: "text", text: buildUserText(input, schedule) });

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // Een menu met notities, prep-stappen en boodschappenlijst paste niet in
        // 2000 tokens; het antwoord kapte af en JSON.parse faalde, waarna je een
        // generieke "er ging iets mis" zag. Mealprep maakt het antwoord langer.
        max_tokens: input.mealprep.aan ? 12000 : 8000,
        system: buildSystemPrompt(input, schedule),
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });
  } catch (err) {
    console.error("Anthropic API onbereikbaar:", err);
    return Response.json(
      { error: "Kon de AI-service niet bereiken. Probeer het opnieuw." },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Anthropic API error:", response.status, errBody);
    return Response.json({ error: `API fout (${response.status}): ${errBody}` }, { status: 502 });
  }

  const data = await response.json();

  if (data.stop_reason === "max_tokens") {
    console.error("Anthropic antwoord afgekapt op max_tokens");
    return Response.json(
      {
        error:
          "Het antwoord was te lang en werd afgekapt. Vink een paar maaltijden minder aan of zet mealprep uit.",
      },
      { status: 502 }
    );
  }

  const text = data.content?.[0]?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Niet stil falen: zonder deze regel in de logs is dit niet te vinden
    console.error("Antwoord was geen geldig JSON-menu:", clean.slice(0, 500));
    return Response.json(
      { error: "Het antwoord kwam niet als geldig menu terug. Probeer het opnieuw." },
      { status: 502 }
    );
  }

  // Bewaar het plan met de gebruikte instellingen erbij, zodat het raster van
  // volgende week begint waar deze week eindigde.
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  try {
    await prisma.mealPlan.create({
      data: {
        weekStart,
        data: JSON.stringify({ ...parsed, instellingen: instellingen ?? null }),
      },
    });
  } catch (err) {
    // Het menu staat al klaar; niet kunnen opslaan mag dat niet weggooien
    console.error("Weekmenu opslaan mislukt:", err);
  }

  return Response.json(parsed);
}
