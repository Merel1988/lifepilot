import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const plans = await prisma.mealPlan.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return Response.json(
    plans.map((p) => ({
      id: p.id,
      weekStart: p.weekStart,
      data: JSON.parse(p.data),
      createdAt: p.createdAt,
    }))
  );
}
