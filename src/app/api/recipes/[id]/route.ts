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

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.category !== undefined) data.category = body.category;
  if (body.ingredients !== undefined) data.ingredients = body.ingredients;
  if (body.description !== undefined) data.description = body.description;
  if (body.servings !== undefined) data.servings = body.servings;
  if (body.favorite !== undefined) data.favorite = body.favorite;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl;

  const recipe = await prisma.recipe.update({ where: { id }, data });
  return Response.json(recipe);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  await prisma.recipe.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
