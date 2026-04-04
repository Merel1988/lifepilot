import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import HabitTracker from "@/components/HabitTracker";

export default async function HabitsPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <HabitTracker />
    </AppShell>
  );
}
