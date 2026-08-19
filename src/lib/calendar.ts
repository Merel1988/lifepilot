import { prisma } from "@/lib/prisma";
import { parseICS, filterEventsByDateRange } from "@/lib/ics-parser";

export interface FeedEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  feedName: string;
  feedColor: string;
  folder: string;
}

export interface CalendarResult {
  events: FeedEvent[];
  /** Aantal ingeschakelde feeds waar we naar gekeken hebben. */
  feeds: number;
  /** Feeds die niet ophaalden. Zichtbaar maken, niet stil verzwijgen. */
  failed: { name: string; reason: string }[];
}

/**
 * Haalt alle ingeschakelde ICS-feeds op en geeft de events in het bereik terug.
 * Zonder `folder` kijken we naar alle feeds — dat is wat de ochtendkaart wil.
 */
export async function getCalendarEvents({
  from,
  to,
  folder,
}: {
  from: Date;
  to: Date;
  folder?: string;
}): Promise<CalendarResult> {
  const feeds = await prisma.calendarFeed.findMany({
    where: folder ? { folder, enabled: true } : { enabled: true },
  });

  const events: FeedEvent[] = [];
  const failed: { name: string; reason: string }[] = [];

  await Promise.all(
    feeds.map(async (feed) => {
      try {
        // webcal:// is hetzelfde als https:// voor een gewone fetch
        const url = feed.url.replace(/^webcal:\/\//, "https://");

        const res = await fetch(url, {
          headers: {
            "User-Agent": "LifePilot/1.0",
            Accept: "text/calendar",
          },
          // Vijf minuten cache, zodat we agendaservers niet plat trekken
          next: { revalidate: 300 },
        });

        if (!res.ok) {
          failed.push({ name: feed.name, reason: `serverfout ${res.status}` });
          return;
        }

        const parsed = filterEventsByDateRange(parseICS(await res.text()), from, to);

        for (const event of parsed) {
          events.push({
            uid: event.uid,
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: event.start.toISOString(),
            end: event.end?.toISOString() || null,
            allDay: event.allDay,
            feedName: feed.name,
            feedColor: feed.color,
            folder: feed.folder,
          });
        }
      } catch (error) {
        failed.push({
          name: feed.name,
          reason: error instanceof Error ? error.message : "onbekende fout",
        });
      }
    })
  );

  events.sort((a, b) => a.start.localeCompare(b.start));

  return { events, feeds: feeds.length, failed };
}
