import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY niet geconfigureerd" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;
  if (!file) {
    return Response.json({ error: "Geen foto meegegeven" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = file.type || "image/jpeg";

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Bekijk deze foto van een recept. Extraheer alle receptinformatie. Geef ALLEEN geldige JSON terug, geen andere tekst:

{"title":"naam van het recept","category":"ONTBIJT|LUNCH|AVONDETEN|OVERIG","ingredients":"ingrediënt 1, ingrediënt 2, ...","description":"bereidingswijze stap voor stap","servings":4}

Als je het aantal personen kunt zien, vul dat in. Vertaal naar het Nederlands als het recept in een andere taal is.`,
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error("Anthropic API error:", aiRes.status, errBody);
      return Response.json(
        { error: "Kon het recept niet herkennen uit de foto" },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const aiText = aiData.content?.[0]?.text || "";
    const clean = aiText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ ...parsed, source: "photo" });
  } catch {
    return Response.json(
      { error: "Kon het recept niet verwerken uit de foto" },
      { status: 500 }
    );
  }
}
