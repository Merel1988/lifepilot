import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.folder !== undefined) data.folder = body.folder;
  if (body.color !== undefined) data.color = body.color;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  // Een lege lijst betekent hier echt "geen enkele agenda", niet "alle"
  if (body.selected !== undefined) {
    data.selected = Array.isArray(body.selected) ? body.selected.join(",") : null;
  }

  const account = await prisma.calendarAccount.update({ where: { id }, data });
  return Response.json({
    id: account.id,
    username: account.username,
    folder: account.folder,
    color: account.color,
    enabled: account.enabled,
    selected: account.selected ? account.selected.split(",").filter(Boolean) : null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  await prisma.calendarAccount.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
