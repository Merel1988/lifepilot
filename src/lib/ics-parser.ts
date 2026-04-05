/**
 * Lightweight ICS/iCal parser — extracts VEVENT blocks and returns structured events.
 * Handles DTSTART/DTEND (date and datetime), SUMMARY, DESCRIPTION, LOCATION, and RRULE basics.
 */

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
  rrule: string | null;
}

function unfoldLines(ics: string): string[] {
  // ICS uses line folding: continuation lines start with a space or tab
  return ics.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function parseICSDate(value: string): { date: Date; allDay: boolean } {
  // Remove any TZID parameter — we'll parse the raw date
  const clean = value.replace(/^.*:/, ""); // strip parameter prefix like TZID=Europe/Amsterdam:

  if (clean.length === 8) {
    // DATE only: YYYYMMDD
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return { date: new Date(y, m, d), allDay: true };
  }

  // DATETIME: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  const y = parseInt(clean.slice(0, 4));
  const m = parseInt(clean.slice(4, 6)) - 1;
  const d = parseInt(clean.slice(6, 8));
  const hh = parseInt(clean.slice(9, 11));
  const mm = parseInt(clean.slice(11, 13));
  const ss = parseInt(clean.slice(13, 15)) || 0;

  if (clean.endsWith("Z")) {
    return { date: new Date(Date.UTC(y, m, d, hh, mm, ss)), allDay: false };
  }

  return { date: new Date(y, m, d, hh, mm, ss), allDay: false };
}

function unescapeICS(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function parseICS(icsText: string): CalendarEvent[] {
  const lines = unfoldLines(icsText);
  const events: CalendarEvent[] = [];
  let inEvent = false;
  let current: Partial<CalendarEvent> & { rawStart?: string; rawEnd?: string } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.rawStart) {
        const startParsed = parseICSDate(current.rawStart);
        current.start = startParsed.date;
        current.allDay = startParsed.allDay;
        if (current.rawEnd) {
          current.end = parseICSDate(current.rawEnd).date;
        }
      }

      if (current.start && current.summary) {
        events.push({
          uid: current.uid || Math.random().toString(36).slice(2),
          summary: current.summary,
          description: current.description || null,
          location: current.location || null,
          start: current.start,
          end: current.end || null,
          allDay: current.allDay || false,
          rrule: current.rrule || null,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    // Parse property:value, handling parameters (;PARAM=val) before the colon
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const fullKey = line.slice(0, colonIdx).toUpperCase();
    const value = line.slice(colonIdx + 1);
    // Base property name (strip parameters like ;TZID=...)
    const propName = fullKey.split(";")[0];

    switch (propName) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = unescapeICS(value);
        break;
      case "DESCRIPTION":
        current.description = unescapeICS(value);
        break;
      case "LOCATION":
        current.location = unescapeICS(value);
        break;
      case "DTSTART":
        current.rawStart = line; // keep full line for date parsing
        break;
      case "DTEND":
        current.rawEnd = line;
        break;
      case "RRULE":
        current.rrule = value;
        break;
    }
  }

  return events;
}

/**
 * Filter events to a date range. For all-day events, checks if the event date falls in range.
 * Does NOT expand recurring events — shows the base occurrence only if in range.
 */
export function filterEventsByDateRange(
  events: CalendarEvent[],
  from: Date,
  to: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const eventEnd = event.end || event.start;
    // Event overlaps with range if it starts before range end AND ends after range start
    return event.start <= to && eventEnd >= from;
  });
}
