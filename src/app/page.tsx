import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import TodayView from "@/components/TodayView";
import { getTodayCard } from "@/lib/today";

// De kaart hangt aan de sessie en de klok, dus nooit prerenderen.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, card] = await Promise.all([auth(), getTodayCard()]);

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      {/* De data komt met de pagina mee: geen leeg scherm met een spinner */}
      <TodayView initial={card} />
    </AppShell>
  );
}
