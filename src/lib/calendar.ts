import { prisma } from "@/lib/prisma";
import { parseICS, filterEventsByDateRange, type CalendarEvent } from "@/lib/ics-parser";
import { CalDavError, fetchCalendarEvents, listCalendars } from "@/lib/caldav";
import { decryptSecret } from "@/lib/secret-box";

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

/**
 * Korte cache voor CalDAV-antwoorden.
 *
 * Een ICS-feed is één GET die Next zelf vijf minuten vasthoudt; een CalDAV-account
 * kost een discovery plus een verzoek per agenda, en dat gebeurt bij elke render
 * van de ochtendkaart. Dit houdt het antwoord even vast per serverinstantie —
 * geen gedeelde cache, maar wel genoeg om iCloud niet bij elke paginaweergave
 * opnieuw te bevragen. Bij een fout wordt er niets bewaard.
 */
const CACHE_MS = 5 * 60 * 1000;
const accountCache = new Map<string, { tijd: number; events: FeedEvent[] }>();

export interface CalendarResult {
  events: FeedEvent[];
  /** Aantal ingeschakelde feeds waar we naar gekeken hebben. */
  feeds: number;
  /** Feeds die niet ophaalden. Zichtbaar maken, niet stil verzwijgen. */
  failed: { name: string; reason: string }[];
}

/**
 * Haalt alles op wat een agenda is: de publieke ICS-feeds én de gekoppelde
 * accounts die we zelf uitlezen (iCloud via CalDAV). Zonder `folder` kijken we
 * naar alles — dat is wat de ochtendkaart wil.
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
  const [feeds, accounts] = await Promise.all([
    prisma.calendarFeed.findMany({
      where: folder ? { folder, enabled: true } : { enabled: true },
    }),
    prisma.calendarAccount.findMany({
      where: folder ? { folder, enabled: true } : { enabled: true },
    }),
  ]);

  const events: FeedEvent[] = [];
  const failed: { name: string; reason: string }[] = [];

  const accountWerk = accounts.map(async (account) => {
    const naam = `iCloud (${account.username})`;
    const cacheKey = `${account.id}|${account.updatedAt.getTime()}|${from.toISOString()}|${to.toISOString()}`;
    const bewaard = accountCache.get(cacheKey);
    if (bewaard && Date.now() - bewaard.tijd < CACHE_MS) {
      events.push(...bewaard.events);
      return;
    }

    try {
      const credentials = {
        username: account.username,
        password: decryptSecret(account.secret),
      };

      // Leeg betekent hier "geen enkele agenda"; null betekent "alle die er zijn"
      const gekozen = account.selected
        ? account.selected.split(",").filter(Boolean)
        : (await listCalendars(credentials)).map((c) => c.url);

      const perAgenda = await Promise.all(
        gekozen.map(async (url) => {
          try {
            return await fetchCalendarEvents(url, credentials, from, to);
          } catch (error) {
            failed.push({
              name: `${naam} — ${url.split("/").filter(Boolean).pop() ?? url}`,
              reason: error instanceof CalDavError ? error.message : "onbekende fout",
            });
            return [] as CalendarEvent[];
          }
        })
      );

      const uitAccount: FeedEvent[] = filterEventsByDateRange(perAgenda.flat(), from, to).map(
        (event) => ({
          uid: event.uid,
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start.toISOString(),
          end: event.end?.toISOString() || null,
          allDay: event.allDay,
          feedName: naam,
          feedColor: account.color,
          folder: account.folder,
        })
      );
      events.push(...uitAccount);
      accountCache.set(cacheKey, { tijd: Date.now(), events: uitAccount });

      // Niet bij elke render schrijven: alleen als er iets te melden valt of het
      // laatste teken van leven oud is. Anders kost de ochtendkaart een schrijf
      // naar Turso per weergave.
      const lang = !account.lastSyncAt || Date.now() - account.lastSyncAt.getTime() > CACHE_MS;
      if (account.lastError || lang) {
        await prisma.calendarAccount
          .update({ where: { id: account.id }, data: { lastSyncAt: new Date(), lastError: null } })
          .catch(() => {});
      }
    } catch (error) {
      const reason =
        error instanceof CalDavError
          ? error.message
          : error instanceof Error
            ? error.message
            : "onbekende fout";
      failed.push({ name: naam, reason });
      // Vastleggen, zodat een kapotte koppeling op /agenda te zien is
      await prisma.calendarAccount
        .update({ where: { id: account.id }, data: { lastError: reason } })
        .catch(() => {});
    }
  });

  await Promise.all([
    ...accountWerk,
    ...feeds.map(async (feed) => {
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
    }),
  ]);

  events.sort((a, b) => a.start.localeCompare(b.start));

  return { events, feeds: feeds.length + accounts.length, failed };
}
