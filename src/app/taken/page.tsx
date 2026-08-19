import { Suspense } from "react";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import ItemListView from "@/components/ItemListView";

export default async function TakenPage() {
  const session = await auth();

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <ItemListView type="TASK" title="Taken" description="Al je taken op één plek" />
      </Suspense>
    </AppShell>
  );
}
