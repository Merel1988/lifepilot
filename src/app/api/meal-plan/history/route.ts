import { prisma } from "@/lib/prisma";

export async function GET() {
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
