import { requireAuth } from "@/lib/auth-guard";
import { getTodayCard } from "@/lib/today";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const card = await getTodayCard();
    return Response.json(card, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Niet stil falen: de gebruiker moet zien dát het misging, en wij waarom.
    console.error("Ochtendkaart samenstellen mislukte:", error);
    return Response.json(
      { error: "De kaart van vandaag kon niet worden geladen. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
