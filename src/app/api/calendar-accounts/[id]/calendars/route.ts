import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { CalDavError, listCalendars } from "@/lib/caldav";
import { decryptSecret } from "@/lib/secret-box";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Welke agenda's dit account nu bij iCloud heeft staan, live opgehaald. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const account = await prisma.calendarAccount.findUnique({ where: { id } });
  if (!account) {
    return Response.json({ error: "Dit account bestaat niet (meer)." }, { status: 404 });
  }

  try {
    const listing = await listCalendars({
      username: account.username,
      password: decryptSecret(account.secret),
    });
    return Response.json(
      { calendars: listing.calendars, diagnose: listing.diagnose, home: listing.home },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const melding =
      error instanceof CalDavError
        ? error.message
        : "Kon de agenda's niet ophalen bij iCloud.";
    console.error("Agenda's ophalen mislukt:", error);
    await prisma.calendarAccount.update({ where: { id }, data: { lastError: melding } });
    return Response.json({ error: melding }, { status: 502 });
  }
}
