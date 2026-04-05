import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";
import { parseICS, filterEventsByDateRange } from "@/lib/ics-parser";

/**
 * GET /api/calendar/[folder]?from=ISO&to=ISO
 * Fetches events from all enabled calendar feeds for the given folder/date range.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { folder } = await params;
  const folderName = folder.toUpperCase();

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  // Default: today to 7 days from now
  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = toParam ? new Date(toParam) : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

  const feeds = await prisma.calendarFeed.findMany({
    where: { folder: folderName, enabled: true },
  });

  if (feeds.length === 0) {
    return Response.json({ events: [], feeds: 0 });
  }

  const allEvents: Array<{
    uid: string;
    summary: string;
    description: string | null;
    location: string | null;
    start: string;
    end: string | null;
    allDay: boolean;
    feedName: string;
    feedColor: string;
  }> = [];

  for (const feed of feeds) {
    try {
      // Normalize URL: webcal:// → https://
      const fetchUrl = feed.url.replace(/^webcal:\/\//, "https://");

      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "LifePilot/1.0",
          "Accept": "text/calendar",
        },
        // Cache for 5 minutes to avoid hammering calendar servers
        next: { revalidate: 300 },
      });

      if (!res.ok) continue;

      const icsText = await res.text();
      const events = parseICS(icsText);
      const filtered = filterEventsByDateRange(events, from, to);

      for (const event of filtered) {
        allEvents.push({
          uid: event.uid,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start.toISOString(),
          end: event.end?.toISOString() || null,
          allDay: event.allDay,
          feedName: feed.name,
          feedColor: feed.color,
        });
      }
    } catch {
      // Skip failed feeds silently
    }
  }

  // Sort by start date
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return Response.json({ events: allEvents, feeds: feeds.length });
}
