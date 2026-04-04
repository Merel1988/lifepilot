import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `Je bent een persoonlijke weekmenu-assistent voor een Nederlandse moeder met een kind van 1,5 jaar. Hier zijn haar vaste regels:

DIEET:
- Zo min mogelijk suiker en omega-6
- Weinig bewerkt voedsel
- Minder brood/koolhydraten (maar niet strict keto - pasta af en toe is prima als uitzondering)
- Grasgevoerd rundvlees (heeft een koe van Grutto - gehakt, bavette, biefstuk)
- Veel zalm en tonijn, af en toe kipfilet
- Kwark en kaas zijn goed
- Ontbijt is altijd chiapudding met havermout en blauwe bessen (dit hoef je NIET in het menu op te nemen)
- Zondag: lunch preppen in max 30 min, geen soep (uitzondering: maïs-aardappel-garnalen soep)

VASTE STRUCTUUR:
- Maandag of Donderdag: VRIJ voor haar man (hij maakt zelf iets of AVG = gebakken aardappeltjes met vis/vlees en groente). Welke dag dit is staat in de input. De andere dag plant hij zelf maar kook je voor hem een simpel recept.
- Dinsdag: SNEL - max 20 minuten, liefst oven-gerecht of iets uit de vriezer
- Vrijdag: ALTIJD frietjes - nooit veranderen
- Zondag: prep-dag, handen-vrij gerecht (oven/slowcooker), zomers van karakter (geen zware stoofpot)

PEUTER-REGELS:
- Geen pittig eten
- Wel: pasta, rijst, noedels, pindasaus (mild), zachte groenten

COURGETTE:
- Nooit alleen courgette in de pan - altijd met: grillpan + citroen + knoflook + feta + pijnboompitten, OF als courgetti met pesto, OF geroosterd in oven

GEBRUIK BONUSARTIKELEN: Verwerk AH bonus-items en Boerschappen box-inhoud slim in het menu waar dat logisch is.

OUTPUTFORMAAT - Geef ALLEEN geldige JSON terug, geen andere tekst, geen markdown backticks:
{
  "week_titel": "korte beschrijving van dit menu",
  "dagen": [
    {
      "dag": "Maandag",
      "maaltijd": "naam van het gerecht",
      "notitie": "korte bereidingstip (max 2 zinnen)",
      "badge": "een van: snel | vrij | frietjes | bonus | prep | null",
      "bonus_item": true of false
    }
  ],
  "zondag_prep": [
    "stap 1 voor de lunch-prep van zondag",
    "stap 2",
    "stap 3"
  ],
  "boodschappenlijst": [
    "item 1",
    "item 2"
  ]
}

Geef altijd precies 7 dagen terug: Maandag t/m Zondag.`;

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const { bonus, boerschappen, voorraad, vrijeDag } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY niet geconfigureerd. Voeg deze toe aan je .env bestand." },
      { status: 500 }
    );
  }

  const userMessage = `Maak een weekmenu voor mij met de volgende input:

AH Bonusaanbiedingen deze week:
${bonus || "Geen opgegeven"}

Boerschappen box inhoud:
${boerschappen || "Geen Boerschappen box deze week"}

Wat ik al in huis heb (vriezer/koelkast):
${voorraad || "Standaard voorraad (zie profiel)"}

Vrije dag voor mijn man: ${vrijeDag === "maandag" ? "Maandag" : "Donderdag"} (hij kookt zelf of maakt AVG)
Andere dag (${vrijeDag === "maandag" ? "Donderdag" : "Maandag"}): geef een simpel recept dat mijn man ook kan maken

Houd rekening met alle vaste regels. Verwerk bonus/boerschappen items slim.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return Response.json({ error: `API fout: ${response.status}` }, { status: 502 });
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
  } catch (e) {
    return Response.json(
      { error: "Er ging iets mis bij het genereren van het menu." },
      { status: 500 }
    );
  }
}
