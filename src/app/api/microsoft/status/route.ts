import { auth, microsoftEnabled } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  // Zonder secrets is de provider niet geregistreerd; dan is koppelen onmogelijk
  // en heeft het geen zin om er een knop voor te tonen.
  if (!microsoftEnabled) {
    return Response.json(
      { available: false, connected: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ available: true, connected: false });
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
    { available: true, connected: (user?.accounts.length ?? 0) > 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
