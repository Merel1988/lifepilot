import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const category = request.nextUrl.searchParams.get("category");
  const favorite = request.nextUrl.searchParams.get("favorite");
  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (favorite === "true") where.favorite = true;

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(recipes, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();

  const recipe = await prisma.recipe.create({
    data: {
      title: body.title,
      category: body.category || "AVONDETEN",
      ingredients: body.ingredients || null,
      description: body.description || null,
      servings: body.servings ?? 4,
      favorite: body.favorite ?? false,
      sourceUrl: body.sourceUrl || null,
      source: body.source || "manual",
    },
  });

  return Response.json(recipe, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
