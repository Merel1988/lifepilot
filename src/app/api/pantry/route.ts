import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const items = await prisma.pantryItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  return Response.json(items);
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();

  // Support adding multiple items at once (comma or newline separated)
  const names: string[] = Array.isArray(body.names)
    ? body.names
    : typeof body.name === "string"
    ? [body.name]
    : [];

  const created = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const item = await prisma.pantryItem.create({ data: { name: trimmed } });
    created.push(item);
  }

  return Response.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const { id } = body;

  if (id) {
    await prisma.pantryItem.delete({ where: { id } });
  }

  return new Response(null, { status: 204 });
}
