import { requireAuth } from "@/lib/auth-guard";
import { getCalendarEvents } from "@/lib/calendar";
import { NextRequest } from "next/server";

/**
 * GET /api/calendar/[folder]?from=ISO&to=ISO
 * Events uit alle ingeschakelde feeds van deze map, in dit datumbereik.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { folder } = await params;

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  const now = new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = toParam ? new Date(toParam) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await getCalendarEvents({
    from,
    to,
    folder: folder.toUpperCase(),
  });

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
