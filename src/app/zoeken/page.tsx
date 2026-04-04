import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import SearchView from "@/components/SearchView";

export default async function SearchPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <SearchView />
    </AppShell>
  );
}
