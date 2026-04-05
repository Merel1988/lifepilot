import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import RecipeManager from "@/components/RecipeManager";

export default async function RecipesPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <RecipeManager />
    </AppShell>
  );
}
