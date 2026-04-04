import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import MealPlanner from "@/components/MealPlanner";

export default async function MealPlannerPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <MealPlanner />
    </AppShell>
  );
}
