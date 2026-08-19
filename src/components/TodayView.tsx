"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CheckEntry, TodayCard, TimelineEntry } from "@/lib/today";

const WEEKDAY_NAMES = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

const MONTH_NAMES = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

function formatDay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${WEEKDAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

function summaryLine(card: TodayCard): string {
  const parts: string[] = [];
  if (card.summary.appointments > 0) {
    parts.push(
      card.summary.appointments === 1
        ? "1 afspraak"
        : `${card.summary.appointments} afspraken`
    );
  }
  if (card.summary.todo > 0) parts.push(`${card.summary.todo} te doen`);
  if (card.summary.meal) parts.push(card.summary.meal.toLowerCase());
  if (parts.length === 0) return "Niks vandaag — fijn";
  return parts.join(" · ");
}

/** Voegt "morgen" toe aan een YYYY-MM-DD zonder tijdzone-gedoe. */
function tomorrow(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function TodayView({ initial }: { initial: TodayCard }) {
  const [card, setCard] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // De server heeft de eerste kaart al meegegeven, dus geen spinner bij het
  // openen. Hierna verversen we alleen na een wijziging of bij terugkeer.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kon vandaag niet verversen.");
        return;
      }
      setCard(data);
      setError(null);
    } catch {
      setError("Geen verbinding. De kaart kan verouderd zijn.");
    }
  }, []);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function toggle(entry: CheckEntry) {
    // Meteen omzetten in de UI, en terugdraaien als het misgaat
    const optimistic = !entry.done;
    setCard((prev) => moveEntry(prev, entry, optimistic));
    setNotice(null);

    const url =
      entry.kind === "habit"
        ? `/api/habits/${entry.id}/complete`
        : entry.recurring
          ? `/api/items/${entry.id}/complete`
          : `/api/items/${entry.id}`;

    try {
      const res = await fetch(url, {
        method: entry.recurring || entry.kind === "habit" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          entry.recurring || entry.kind === "habit"
            ? { date: card.day }
            : { completed: optimistic }
        ),
      });
      if (!res.ok) throw new Error(String(res.status));
      await refresh();
    } catch {
      setCard((prev) => moveEntry(prev, entry, !optimistic));
      setError(`"${entry.title}" kon niet worden bijgewerkt. Probeer het opnieuw.`);
    }
  }

  async function moveToTomorrow(id: string, title: string) {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: tomorrow(card.day) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setNotice(`"${title}" staat nu op morgen.`);
      await refresh();
    } catch {
      setError(`"${title}" kon niet worden verzet.`);
    }
  }

  const nothingToday =
    card.timeline.length === 0 && card.untimed.length === 0 && !card.meal;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 first-letter:uppercase">
          {formatDay(card.day)}
        </h1>
        <p className="text-gray-500">{summaryLine(card)}</p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            onClick={() => void refresh()}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            Opnieuw
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="text-sm text-violet-700">
          {notice}
        </p>
      )}

      {card.calendar.failed.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {card.calendar.failed.length === 1
            ? `De agenda "${card.calendar.failed[0].name}" laadde niet (${card.calendar.failed[0].reason}).`
            : `${card.calendar.failed.length} agenda's laadden niet.`}{" "}
          <Link href="/agenda" className="font-medium underline underline-offset-2">
            Nakijken
          </Link>
        </div>
      )}

      {nothingToday ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-gray-500">
          Niks voor vandaag — fijn.
        </p>
      ) : (
        <>
          {card.timeline.length > 0 && (
            <Timeline entries={card.timeline} now={card.now} />
          )}

          {card.meal && (
            <section className="space-y-2">
              <SectionLabel>Vanavond</SectionLabel>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="font-medium text-gray-900">{card.meal.title}</p>
                {card.meal.note && (
                  <p className="mt-0.5 text-sm text-gray-500">{card.meal.note}</p>
                )}
              </div>
            </section>
          )}

          {card.untimed.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Zonder tijd</SectionLabel>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {card.untimed.map((entry) => (
                  <CheckRow
                    key={`${entry.kind}-${entry.id}`}
                    entry={entry}
                    onToggle={() => void toggle(entry)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {card.calendar.feeds === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
          Er is nog geen agenda gekoppeld, dus je afspraken staan hier niet.{" "}
          <Link href="/agenda" className="font-medium text-violet-700 underline underline-offset-2">
            Agenda toevoegen
          </Link>
        </p>
      )}

      {card.overdue.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setShowOverdue((v) => !v)}
            className="flex w-full items-center gap-2 py-2 text-left text-sm text-gray-500 hover:text-gray-900"
          >
            <span className={showOverdue ? "rotate-90 transition-transform" : "transition-transform"}>
              ▸
            </span>
            {card.overdue.length} achterstallig
          </button>
          {showOverdue && (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {card.overdue.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-gray-900">{entry.title}</span>
                    {entry.category && (
                      <span className="text-xs text-gray-400">{entry.category}</span>
                    )}
                  </span>
                  <button
                    onClick={() => void moveToTomorrow(entry.id, entry.title)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-700"
                  >
                    Naar morgen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {card.done.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center gap-2 py-2 text-left text-sm text-gray-500 hover:text-gray-900"
          >
            <span className={showDone ? "rotate-90 transition-transform" : "transition-transform"}>
              ▸
            </span>
            {card.done.length} afgerond vandaag
          </button>
          {showDone && (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {card.done.map((entry) => (
                <CheckRow
                  key={`${entry.kind}-${entry.id}`}
                  entry={entry}
                  onToggle={() => void toggle(entry)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
      {children}
    </h2>
  );
}

/**
 * Afspraken en taken door elkaar op één tijdlijn, met een streep op nu.
 * Dat samenvoegen is precies wat je nergens anders hebt.
 */
function Timeline({ entries, now }: { entries: TimelineEntry[]; now: string }) {
  // De nu-streep komt vóór de eerste regel die nog moet komen
  const upcomingIndex = entries.findIndex((e) => e.time && e.time >= now);

  return (
    <section className="space-y-2">
      <SectionLabel>Vandaag</SectionLabel>
      <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {entries.map((entry, index) => (
          <li key={`${entry.kind}-${entry.id}-${index}`}>
            {index === upcomingIndex && <NowLine label={now} />}
            <div className="flex gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
              <span
                className={`w-12 shrink-0 pt-0.5 text-sm tabular-nums ${
                  entry.kind === "event" ? "font-medium text-violet-700" : "text-gray-400"
                }`}
              >
                {entry.time || "hele dag"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-gray-900">{entry.title}</span>
                {entry.subtitle && (
                  <span className="block truncate text-xs text-gray-400">
                    {entry.subtitle}
                  </span>
                )}
              </span>
              {entry.category && (
                <span className="shrink-0 self-start pt-0.5 text-xs text-gray-400">
                  {entry.category}
                </span>
              )}
            </div>
          </li>
        ))}
        {upcomingIndex === -1 && <NowLine label={now} />}
      </ul>
    </section>
  );
}

function NowLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-1.5">
      <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-violet-600">
        {label}
      </span>
      <span className="h-px flex-1 bg-violet-300" />
    </div>
  );
}

function CheckRow({
  entry,
  onToggle,
}: {
  entry: CheckEntry;
  onToggle: () => void;
}) {
  return (
    <li>
      {/* De hele regel is de knop, niet alleen het rondje */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
        aria-pressed={entry.done}
      >
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
            entry.done ? "border-violet-600 bg-violet-600" : "border-gray-300"
          }`}
          style={
            !entry.done && entry.color ? { borderColor: entry.color } : undefined
          }
        >
          {entry.done && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6.5l2.5 2.5 4.5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate ${
              entry.done ? "text-gray-400 line-through" : "text-gray-900"
            }`}
          >
            {entry.title}
          </span>
        </span>
        {entry.category && (
          <span className="shrink-0 text-xs text-gray-400">{entry.category}</span>
        )}
      </button>
    </li>
  );
}

/** Verplaatst een regel optimistisch tussen "te doen" en "afgerond". */
function moveEntry(card: TodayCard, entry: CheckEntry, done: boolean): TodayCard {
  const matches = (e: CheckEntry) => e.kind === entry.kind && e.id === entry.id;
  const updated = { ...entry, done };

  if (done) {
    return {
      ...card,
      untimed: card.untimed.filter((e) => !matches(e)),
      done: [...card.done, updated],
      summary: { ...card.summary, todo: Math.max(0, card.summary.todo - 1) },
    };
  }

  return {
    ...card,
    done: card.done.filter((e) => !matches(e)),
    untimed: [...card.untimed, updated],
    summary: { ...card.summary, todo: card.summary.todo + 1 },
  };
}
