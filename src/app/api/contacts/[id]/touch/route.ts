import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

/**
 * "Ik heb ze gesproken." Zet de teller terug, zodat het contact pas na het
 * ingestelde aantal weken weer op de ochtendkaart komt. Eén knop, geen formulier.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;

  try {
    const contact = await prisma.contact.update({
      where: { id },
      data: { lastContactAt: new Date() },
      select: { id: true, name: true, lastContactAt: true },
    });
    return Response.json(contact, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Contactmoment opslaan mislukte:", error);
    return Response.json({ error: "Kon dit niet opslaan." }, { status: 500 });
  }
}
