import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const RRULE_DAYS: Record<number, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatDateICS(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDateTimeICS(date: Date, time?: string | null): string {
  const dateStr = formatDateICS(date);
  if (time) {
    const [hh, mm] = time.split(":");
    return `${dateStr}T${hh}${mm}00`;
  }
  return `${dateStr}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  const { folder } = await params;

  // Auth via token parameter
  const token = request.nextUrl.searchParams.get("token");
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken || token !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Strip .ics extension if present
  const folderName = folder.replace(/\.ics$/, "").toUpperCase();
  const validFolders = ["PRIVE", "WERK", "JANNIE_MEPPEL"];
  if (!validFolders.includes(folderName)) {
    return new Response("Not Found", { status: 404 });
  }

  const folderLabels: Record<string, string> = {
    PRIVE: "Privé",
    WERK: "Werk",
    JANNIE_MEPPEL: "Jannie Meppel",
  };

  const items = await prisma.item.findMany({
    where: { folder: folderName },
    orderBy: { date: "asc" },
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LifePilot//NL",
    `X-WR-CALNAME:LifePilot - ${folderLabels[folderName]}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const item of items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.id}@lifepilot`);
    lines.push(`SUMMARY:${escapeICS(item.title)}`);

    if (item.description) {
      lines.push(`DESCRIPTION:${escapeICS(item.description)}`);
    }

    // Category based on type
    const typeLabels: Record<string, string> = { TASK: "Taak", REMINDER: "Herinnering", NOTE: "Notitie" };
    lines.push(`CATEGORIES:${typeLabels[item.type] || item.type}`);

    if (item.recurring && item.recurrenceDays) {
      // Recurring item — use RRULE
      const days = item.recurrenceDays.split(",").map(Number);
      const rruleDays = days.map((d) => RRULE_DAYS[d]).filter(Boolean).join(",");
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDays}`);

      // Use today as start date for recurring items without a fixed date
      const startDate = item.date ? new Date(item.date) : new Date();
      if (item.time) {
        lines.push(`DTSTART:${formatDateTimeICS(startDate, item.time)}`);
        // 1 hour duration for timed events
        const endDate = new Date(startDate);
        const [hh, mm] = item.time.split(":").map(Number);
        endDate.setHours(hh + 1, mm);
        lines.push(`DTEND:${formatDateTimeICS(endDate, `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${formatDateICS(startDate)}`);
        lines.push(`DTEND;VALUE=DATE:${formatDateICS(startDate)}`);
      }
    } else if (item.date) {
      const date = new Date(item.date);
      if (item.time) {
        lines.push(`DTSTART:${formatDateTimeICS(date, item.time)}`);
        const endDate = new Date(date);
        const [hh, mm] = item.time.split(":").map(Number);
        endDate.setHours(hh + 1, mm);
        lines.push(`DTEND:${formatDateTimeICS(endDate, `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${formatDateICS(date)}`);
        lines.push(`DTEND;VALUE=DATE:${formatDateICS(date)}`);
      }

      // Add alarm for reminders
      if (item.type === "REMINDER" && item.time) {
        lines.push("BEGIN:VALARM");
        lines.push("TRIGGER:PT0M");
        lines.push("ACTION:DISPLAY");
        lines.push(`DESCRIPTION:${escapeICS(item.title)}`);
        lines.push("END:VALARM");
      }
    } else {
      // No date — use createdAt as a reference
      const created = new Date(item.createdAt);
      lines.push(`DTSTART;VALUE=DATE:${formatDateICS(created)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateICS(created)}`);
    }

    if (item.completed) {
      lines.push("STATUS:COMPLETED");
    }

    lines.push(`DTSTAMP:${formatDateICS(new Date(item.updatedAt))}T000000Z`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${folderName}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
