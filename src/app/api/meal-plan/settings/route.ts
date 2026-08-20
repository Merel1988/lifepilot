import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/**
 * De instellingen van het laatst gemaakte weekmenu: welk raster, welke
 * gewoontes en welke mealprep-getallen. Zo begint het formulier volgende week
 * waar het vorige week eindigde in plaats van bij een aanname.
 *
 * Ze staan in het `data`-JSON van de MealPlan-rij (sleutel `instellingen`), dus
 * hier is geen extra kolom voor nodig.
 */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const laatste = await prisma.mealPlan.findFirst({
    orderBy: { createdAt: "desc" },
    select: { data: true, weekStart: true },
  });

  let instellingen: unknown = null;
  if (laatste) {
    try {
      const parsed = JSON.parse(laatste.data) as { instellingen?: unknown };
      instellingen = parsed.instellingen ?? null;
    } catch {
      // Een onleesbaar plan betekent gewoon: begin met de standaardinstellingen
      instellingen = null;
    }
  }

  return Response.json(
    { instellingen, weekStart: laatste?.weekStart ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
