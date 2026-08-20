import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { CalDavError, listCalendars } from "@/lib/caldav";
import { encryptSecret } from "@/lib/secret-box";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Nooit het wachtwoord teruggeven, ook niet versleuteld. */
function publiek(account: {
  id: string;
  provider: string;
  username: string;
  folder: string;
  color: string;
  enabled: boolean;
  selected: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
}) {
  return {
    id: account.id,
    provider: account.provider,
    username: account.username,
    folder: account.folder,
    color: account.color,
    enabled: account.enabled,
    selected: account.selected ? account.selected.split(",").filter(Boolean) : null,
    lastSyncAt: account.lastSyncAt,
    lastError: account.lastError,
  };
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const accounts = await prisma.calendarAccount.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json(accounts.map(publiek), {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Koppelt een iCloud-account. De verbinding wordt eerst getest: liever meteen een
 * duidelijke fout dan een rij in de database die stil niets oplevert.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const username = String(body.username ?? "").trim();
  // Apple toont app-specifieke wachtwoorden met streepjes; die horen er niet in
  const password = String(body.password ?? "").replace(/[\s-]/g, "");

  if (!username || !password) {
    return Response.json(
      { error: "Vul je Apple ID en het app-specifieke wachtwoord in." },
      { status: 400 }
    );
  }

  let calendars;
  try {
    calendars = await listCalendars({ username, password });
  } catch (error) {
    const melding =
      error instanceof CalDavError
        ? error.message
        : "Kon geen verbinding maken met iCloud. Probeer het later opnieuw.";
    console.error("iCloud koppelen mislukt:", error);
    return Response.json({ error: melding }, { status: 502 });
  }

  if (calendars.length === 0) {
    return Response.json(
      { error: "Verbinding gelukt, maar er zijn geen agenda's met afspraken gevonden." },
      { status: 502 }
    );
  }

  const account = await prisma.calendarAccount.create({
    data: {
      provider: "ICLOUD",
      username,
      secret: encryptSecret(password),
      folder: body.folder || "PRIVE",
      color: body.color || "#6d28d9",
      // Standaard alles aan: uitzetten is makkelijker dan ontdekken dat er iets mist
      selected: calendars.map((c) => c.url).join(","),
    },
  });

  return Response.json({ account: publiek(account), calendars }, { status: 201 });
}
