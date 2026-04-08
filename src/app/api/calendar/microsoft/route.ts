import { requireAuth } from "@/lib/auth-guard";
import { fetchMicrosoftCalendarEvents } from "@/lib/microsoft-graph";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return Response.json({ error: "from and to parameters required" }, { status: 400 });
  }

  const events = await fetchMicrosoftCalendarEvents(from, to);

  return Response.json(
    { events },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
