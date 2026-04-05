import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import CalendarView from "@/components/CalendarView";

export default async function AgendaPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <CalendarView />
    </AppShell>
  );
}
