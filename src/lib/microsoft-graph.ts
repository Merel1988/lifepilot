import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

async function refreshAccessToken(account: {
  id: string;
  refresh_token: string | null;
}): Promise<string | null> {
  if (!account.refresh_token) return null;

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope: "openid profile email User.Read Calendars.Read Mail.Read offline_access",
    }),
  });

  if (!res.ok) return null;

  const tokens: MicrosoftTokens = await res.json();

  // Update stored tokens
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
    },
  });

  return tokens.access_token;
}

/**
 * Get a valid Microsoft access token for the current user.
 * Automatically refreshes if expired.
 */
export async function getMicrosoftAccessToken(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      accounts: {
        where: { provider: "microsoft-entra-id" },
      },
    },
  });

  const account = user?.accounts[0];
  if (!account?.access_token) return null;

  // Check if token is expired (with 5-minute buffer)
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at < now + 300) {
    return refreshAccessToken(account);
  }

  return account.access_token;
}

/**
 * Fetch calendar events from Microsoft Graph API.
 */
export async function fetchMicrosoftCalendarEvents(
  from: string,
  to: string
): Promise<CalendarEvent[]> {
  const token = await getMicrosoftAccessToken();
  if (!token) return [];

  // First get list of calendars
  const calendarsRes = await fetch("https://graph.microsoft.com/v1.0/me/calendars", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!calendarsRes.ok) return [];
  const calendarsData = await calendarsRes.json();

  // Fetch events from all calendars
  const events: CalendarEvent[] = [];

  for (const cal of calendarsData.value || []) {
    const eventsRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${cal.id}/calendarView?startDateTime=${from}&endDateTime=${to}&$top=100&$select=subject,start,end,location,isAllDay`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="Europe/Amsterdam"',
        },
      }
    );

    if (!eventsRes.ok) continue;
    const eventsData = await eventsRes.json();

    for (const event of eventsData.value || []) {
      events.push({
        uid: event.id,
        summary: event.subject || "(Geen titel)",
        location: event.location?.displayName || null,
        start: event.start?.dateTime
          ? new Date(event.start.dateTime + (event.start.timeZone === "UTC" ? "Z" : "")).toISOString()
          : new Date().toISOString(),
        end: event.end?.dateTime
          ? new Date(event.end.dateTime + (event.end.timeZone === "UTC" ? "Z" : "")).toISOString()
          : null,
        allDay: event.isAllDay || false,
        feedName: cal.name || "Microsoft",
        feedColor: cal.hexColor || "#0078d4",
      });
    }
  }

  // Sort by start time
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return events;
}

interface CalendarEvent {
  uid: string;
  summary: string;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  feedName: string;
  feedColor: string;
}
