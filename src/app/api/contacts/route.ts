import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

/** Leest de velden uit een verzoek en houdt alleen geldige waarden over. */
function readFields(body: Record<string, unknown>) {
  const text = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const number = (value: unknown, min: number, max: number) => {
    if (value === "" || value === null) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) return undefined;
    return n;
  };

  return {
    name: text(body.name),
    phone: text(body.phone),
    email: text(body.email),
    address: text(body.address),
    notes: text(body.notes),
    birthDay: number(body.birthDay, 1, 31),
    birthMonth: number(body.birthMonth, 1, 12),
    birthYear: number(body.birthYear, 1900, 2100),
    keepInTouchWeeks: number(body.keepInTouchWeeks, 1, 260),
  };
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { name: "asc" },
    });

    return Response.json(contacts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Contacten ophalen mislukte:", error);
    return Response.json(
      { error: "Contacten konden niet worden geladen." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const fields = readFields(await request.json());

    if (!fields.name) {
      return Response.json({ error: "Een naam is verplicht." }, { status: 400 });
    }

    // Een dag zonder maand (of omgekeerd) levert een verjaardag op die nooit valt
    if ((fields.birthDay ?? null) !== null && (fields.birthMonth ?? null) === null) {
      return Response.json(
        { error: "Vul bij een verjaardag zowel de dag als de maand in." },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        name: fields.name,
        phone: fields.phone ?? null,
        email: fields.email ?? null,
        address: fields.address ?? null,
        notes: fields.notes ?? null,
        birthDay: fields.birthDay ?? null,
        birthMonth: fields.birthMonth ?? null,
        birthYear: fields.birthYear ?? null,
        keepInTouchWeeks: fields.keepInTouchWeeks ?? null,
      },
    });

    return Response.json(contact, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Contact opslaan mislukte:", error);
    return Response.json({ error: "Contact kon niet worden opgeslagen." }, { status: 500 });
  }
}
