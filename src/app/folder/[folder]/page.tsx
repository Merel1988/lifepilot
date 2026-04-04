import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import FolderView from "@/components/FolderView";
import type { MainFolder } from "@/lib/folders";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folder: string }>;
}) {
  const { folder } = await params;

  return (
    <AppShell>
      <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
        <FolderView folder={folder as MainFolder} />
      </Suspense>
    </AppShell>
  );
}
