import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { url } = await request.json();
  if (!url || typeof url !== "string") {
    return Response.json({ error: "URL is verplicht" }, { status: 400 });
  }

  try {
    // Fetch the page HTML
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!pageRes.ok) {
      return Response.json(
        { error: `Kon pagina niet ophalen (${pageRes.status})` },
        { status: 400 }
      );
    }

    const html = await pageRes.text();

    // Try to extract JSON-LD recipe schema (free, no API call needed)
    const recipe = extractJsonLdRecipe(html);
    if (recipe) {
      return Response.json({ ...recipe, sourceUrl: url, source: "url" });
    }

    // Fallback: use Claude Haiku to extract recipe from HTML
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Geen gestructureerde receptdata gevonden en ANTHROPIC_API_KEY niet ingesteld" },
        { status: 400 }
      );
    }

    // Strip HTML to reduce token usage — keep only text content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Extraheer het recept uit deze webpagina tekst. Geef ALLEEN geldige JSON terug, geen andere tekst:\n\n${textContent}\n\nJSON formaat:\n{"title":"naam","category":"ONTBIJT|LUNCH|AVONDETEN|OVERIG","ingredients":"ingrediënt 1, ingrediënt 2, ...","description":"bereidingswijze stap voor stap","servings":4}`,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      return Response.json(
        { error: "Kon recept niet herkennen uit deze pagina" },
        { status: 400 }
      );
    }

    const aiData = await aiRes.json();
    const aiText = aiData.content?.[0]?.text || "";
    const clean = aiText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ ...parsed, sourceUrl: url, source: "url" });
  } catch {
    return Response.json(
      { error: "Kon het recept niet ophalen van deze URL" },
      { status: 500 }
    );
  }
}

function extractJsonLdRecipe(html: string) {
  // Find all JSON-LD script blocks
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const recipe = findRecipeInJsonLd(data);
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }
  return null;
}

function findRecipeInJsonLd(data: unknown): {
  title: string;
  ingredients: string;
  description: string;
  servings: number;
  category: string;
} | null {
  if (!data || typeof data !== "object") return null;

  // Handle arrays (e.g. @graph)
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findRecipeInJsonLd(item);
      if (result) return result;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }

  // Check if this is a Recipe type
  const type = obj["@type"];
  const isRecipe =
    type === "Recipe" ||
    (Array.isArray(type) && type.includes("Recipe"));

  if (!isRecipe) return null;

  const title = (obj.name as string) || "";
  if (!title) return null;

  // Extract ingredients
  const ingredients = Array.isArray(obj.recipeIngredient)
    ? (obj.recipeIngredient as string[]).join(", ")
    : "";

  // Extract instructions
  let description = "";
  if (Array.isArray(obj.recipeInstructions)) {
    description = (obj.recipeInstructions as Array<unknown>)
      .map((step, i) => {
        if (typeof step === "string") return `${i + 1}. ${step}`;
        if (typeof step === "object" && step !== null) {
          const s = step as Record<string, unknown>;
          return `${i + 1}. ${s.text || s.name || ""}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof obj.recipeInstructions === "string") {
    description = obj.recipeInstructions;
  }

  // Extract servings
  let servings = 4;
  const yield_ = obj.recipeYield;
  if (typeof yield_ === "number") {
    servings = yield_;
  } else if (typeof yield_ === "string") {
    const num = parseInt(yield_.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > 0) servings = num;
  } else if (Array.isArray(yield_) && yield_.length > 0) {
    const num = parseInt(String(yield_[0]).replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > 0) servings = num;
  }

  // Guess category from keywords
  let category = "AVONDETEN";
  const keywords = [
    obj.recipeCategory,
    ...(Array.isArray(obj.keywords) ? obj.keywords : [obj.keywords]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (keywords.includes("ontbijt") || keywords.includes("breakfast")) {
    category = "ONTBIJT";
  } else if (keywords.includes("lunch")) {
    category = "LUNCH";
  }

  return { title, ingredients, description, servings, category };
}
