import { Suspense } from "react";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import FolderView from "@/components/FolderView";
import type { MainFolder } from "@/lib/folders";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folder: string }>;
}) {
  const [{ folder }, session] = await Promise.all([params, auth()]);

  return (
    <AppShell userName={session?.user?.name} userImage={session?.user?.image}>
      <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <FolderView folder={folder as MainFolder} />
      </Suspense>
    </AppShell>
  );
}
