import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ connected: false });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      accounts: {
        where: { provider: "microsoft-entra-id" },
        select: { id: true },
      },
    },
  });

  return Response.json(
    { connected: (user?.accounts.length ?? 0) > 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
