"use client";

import { useMemo, useRef, useState } from "react";
import { formatDayShort, relativeDayLabel } from "@/lib/day";
import { MAIN_FOLDERS, type ItemType, type MainFolder, getDefaultFolder } from "@/lib/folders";
import { formatRecurrenceDays } from "@/lib/types";
import { parseQuickInput } from "@/lib/parse-input";

interface QuickAddProps {
  /** Het type dat je krijgt als de tekst niets anders aangeeft. */
  defaultType?: ItemType;
  onCreated?: () => void;
  /** Escape naar het volledige formulier, met de getypte tekst als titel. */
  onMoreFields?: (text: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  TASK: "Taak",
  REMINDER: "Herinnering",
  NOTE: "Notitie",
};

const CHIP = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium";

/**
 * Dumpveld: één regel tekst in plaats van een formulier met acht velden.
 *
 * De preview eronder is het hele punt. De parser gokt (datum, tijd, type,
 * categorie) en je ziet meteen wát hij ervan maakte, dus een verkeerde gok
 * kost één tik in plaats van een verkeerd gelabeld item dat je nooit terugvindt.
 */
export default function QuickAdd({ defaultType, onCreated, onMoreFields }: QuickAddProps) {
  const [text, setText] = useState("");
  const [dateOverride, setDateOverride] = useState<string | null | undefined>(undefined);
  const [timeOverride, setTimeOverride] = useState<string | null | undefined>(undefined);
  const [folderOverride, setFolderOverride] = useState<MainFolder | null>(null);
  const [editing, setEditing] = useState<"date" | "time" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; label: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickInput(text, { defaultType }), [text, defaultType]);

  const type = parsed.type;
  const isNote = type === "NOTE";
  const date = isNote ? null : dateOverride !== undefined ? dateOverride : parsed.date;
  const time = isNote ? null : timeOverride !== undefined ? timeOverride : parsed.time;
  const folder = folderOverride ?? parsed.folder ?? getDefaultFolder();
  const title = parsed.title;
  const showPreview = text.trim().length > 0;

  function clearAll() {
    setText("");
    setDateOverride(undefined);
    setTimeOverride(undefined);
    setFolderOverride(null);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          date: parsed.recurring ? null : date,
          time,
          folder,
          recurring: parsed.recurring,
          recurrenceDays: parsed.recurring ? parsed.recurrenceDays.join(",") : null,
        }),
      });
      if (!res.ok) {
        setError("Opslaan lukte niet. Probeer het nog eens.");
        return;
      }
      const item = await res.json();
      setAdded({ id: item.id, label: summarize(title, date, time, parsed.recurring, parsed.recurrenceDays) });
      clearAll();
      onCreated?.();
      window.dispatchEvent(new CustomEvent("item-moved"));
      inputRef.current?.focus();
    } catch {
      setError("Opslaan lukte niet — geen verbinding?");
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!added) return;
    const id = added.id;
    setAdded(null);
    try {
      await fetch(`/api/items/${id}`, { method: "DELETE" });
      onCreated?.();
      window.dispatchEvent(new CustomEvent("item-moved"));
    } catch {
      setError("Terugdraaien lukte niet.");
    }
  }

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAdded(null);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") clearAll();
            }}
            placeholder={
              defaultType === "NOTE"
                ? "Schrijf het op — je kunt het later uitwerken"
                : 'Dump het hier — "morgen 9u tandarts"'
            }
            className="flex-1 min-w-0 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-gray-900 placeholder-gray-400"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!title || saving}
            className="px-5 py-3 bg-violet-600 text-white rounded-2xl font-medium text-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-600/20"
          >
            {saving ? "..." : "Voeg toe"}
          </button>
        </div>

        {showPreview && (
          <div className="mt-2 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-2.5">
            <p className="text-sm text-gray-900">
              {title ? (
                <span className="font-medium">{title}</span>
              ) : (
                <span className="text-gray-400">Nog geen titel — wat moet er gebeuren?</span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`${CHIP} bg-gray-100 text-gray-600`}>{TYPE_LABELS[type]}</span>

              {parsed.recurring ? (
                <span className={`${CHIP} bg-violet-50 text-violet-700`}>
                  elke {formatRecurrenceDays(parsed.recurrenceDays.join(","))}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(editing === "date" ? null : "date")}
                  disabled={isNote}
                  className={`${CHIP} ${
                    date ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-500"
                  } disabled:opacity-50`}
                >
                  {date ? dateLabel(date) : "geen datum"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditing(editing === "time" ? null : "time")}
                disabled={isNote}
                className={`${CHIP} ${
                  time ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-500"
                } disabled:opacity-50`}
              >
                {time ?? "geen tijd"}
              </button>
            </div>

            {editing === "date" && !parsed.recurring && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date ?? ""}
                  onChange={(e) => setDateOverride(e.target.value || null)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setDateOverride(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Wissen
                </button>
              </div>
            )}

            {editing === "time" && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={time ?? ""}
                  onChange={(e) => setTimeOverride(e.target.value || null)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setTimeOverride(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Wissen
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {MAIN_FOLDERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolderOverride(f.id)}
                  className={`${CHIP} ${
                    folder === f.id
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {onMoreFields && (
                <button
                  type="button"
                  onClick={() => onMoreFields(text)}
                  className="ml-auto text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  Meer velden
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {added && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <span className="truncate">Toegevoegd: {added.label}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-violet-600 hover:text-violet-700 font-medium whitespace-nowrap"
          >
            Ongedaan maken
          </button>
        </div>
      )}
    </div>
  );
}

/** "morgen · do 20 aug" — het relatieve woord plus de echte datum erachter. */
function dateLabel(day: string): string {
  const relative = relativeDayLabel(day);
  const short = formatDayShort(day);
  return relative === short ? short : `${relative} · ${short}`;
}

function summarize(
  title: string,
  date: string | null,
  time: string | null,
  recurring: boolean,
  days: number[]
): string {
  const parts = [title];
  if (recurring) parts.push(`elke ${formatRecurrenceDays(days.join(","))}`);
  else if (date) parts.push(relativeDayLabel(date));
  if (time) parts.push(time);
  return parts.join(" · ");
}
