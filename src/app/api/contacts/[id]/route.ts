import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();

  // Alleen velden die echt zijn meegestuurd aanpassen
  const data: Record<string, unknown> = {};

  const setText = (key: string) => {
    if (body[key] === undefined) return;
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    data[key] = value === "" ? null : value;
  };

  const setNumber = (key: string, min: number, max: number) => {
    if (body[key] === undefined) return;
    if (body[key] === "" || body[key] === null) {
      data[key] = null;
      return;
    }
    const n = Number(body[key]);
    if (Number.isInteger(n) && n >= min && n <= max) data[key] = n;
  };

  setText("name");
  setText("phone");
  setText("email");
  setText("address");
  setText("notes");
  setNumber("birthDay", 1, 31);
  setNumber("birthMonth", 1, 12);
  setNumber("birthYear", 1900, 2100);
  setNumber("keepInTouchWeeks", 1, 260);

  if (data.name === null) {
    return Response.json({ error: "Een naam is verplicht." }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.update({ where: { id }, data });
    return Response.json(contact, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Contact bijwerken mislukte:", error);
    return Response.json({ error: "Contact kon niet worden bijgewerkt." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;

  try {
    await prisma.contact.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Contact verwijderen mislukte:", error);
    return Response.json({ error: "Contact kon niet worden verwijderd." }, { status: 500 });
  }
}
