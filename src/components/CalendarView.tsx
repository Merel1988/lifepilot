"use client";

import { useState, useEffect, useCallback } from "react";
import { MAIN_FOLDERS } from "@/lib/folders";

interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  folder: string;
  color: string;
  enabled: boolean;
}

interface CalendarEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  feedName: string;
  feedColor: string;
}

const PRESET_COLORS = ["#7c3aed", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

export default function CalendarView() {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

  // Add feed form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFolder, setNewFolder] = useState("PRIVE");
  const [newColor, setNewColor] = useState("#7c3aed");

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-feeds", { cache: "no-store" });
      setFeeds(await res.json());
      // Check Microsoft connection status
      const msRes = await fetch("/api/microsoft/status", { cache: "no-store" });
      if (msRes.ok) {
        const msData = await msRes.json();
        setMicrosoftConnected(msData.connected);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

      const folders = [...new Set(feeds.filter((f) => f.enabled).map((f) => f.folder))];
      const allEvents: CalendarEvent[] = [];

      // Fetch ICS feed events
      for (const folder of folders) {
        const res = await fetch(
          `/api/calendar/${folder}?from=${from.toISOString()}&to=${to.toISOString()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        allEvents.push(...(data.events || []));
      }

      // Fetch Microsoft calendar events if connected
      if (microsoftConnected) {
        try {
          const msRes = await fetch(
            `/api/calendar/microsoft?from=${from.toISOString()}&to=${to.toISOString()}`,
            { cache: "no-store" }
          );
          if (msRes.ok) {
            const msData = await msRes.json();
            allEvents.push(...(msData.events || []));
          }
        } catch {
          // Microsoft calendar fetch is optional
        }
      }

      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setEvents(allEvents);
    } finally {
      setEventsLoading(false);
    }
  }, [feeds, microsoftConnected]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  useEffect(() => {
    if (feeds.length > 0 || microsoftConnected) {
      fetchEvents();
    }
  }, [feeds, microsoftConnected, fetchEvents]);

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;

    await fetch("/api/calendar-feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        url: newUrl,
        folder: newFolder,
        color: newColor,
      }),
    });

    setNewName("");
    setNewUrl("");
    setNewFolder("PRIVE");
    setNewColor("#7c3aed");
    setShowAddFeed(false);
    fetchFeeds();
  }

  async function toggleFeed(id: string, enabled: boolean) {
    await fetch(`/api/calendar-feeds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchFeeds();
  }

  async function deleteFeed(id: string) {
    await fetch(`/api/calendar-feeds/${id}`, { method: "DELETE" });
    fetchFeeds();
  }

  // Group events by day
  const eventsByDay: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const dateKey = new Date(event.start).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!eventsByDay[dateKey]) eventsByDay[dateKey] = [];
    eventsByDay[dateKey].push(event);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-500 mt-1">
          Je agenda-events uit Microsoft Calendar en Apple Calendar
        </p>
      </div>

      {/* Microsoft connection */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 23 23">
            <rect x="1" y="1" width="10" height="10" fill="#f25022" />
            <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
            <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
            <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Microsoft 365</p>
            <p className="text-xs text-gray-400">
              {microsoftConnected
                ? "Agenda gekoppeld — events worden automatisch opgehaald"
                : "Koppel je werkaccount voor agenda en later e-mail"}
            </p>
          </div>
          {microsoftConnected ? (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              Gekoppeld
            </span>
          ) : (
            <button
              onClick={async () => {
                setMicrosoftLoading(true);
                // Redirect to Microsoft sign-in via NextAuth
                const { signIn } = await import("next-auth/react");
                signIn("microsoft-entra-id", { callbackUrl: "/agenda" });
              }}
              disabled={microsoftLoading}
              className="text-xs font-medium text-white bg-[#0078d4] px-3 py-1.5 rounded-lg hover:bg-[#106ebe] transition-colors disabled:opacity-50"
            >
              {microsoftLoading ? "Verbinden..." : "Koppelen"}
            </button>
          )}
        </div>
      </div>

      {/* Feed management */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Gekoppelde agenda&apos;s</h3>
          <button
            onClick={() => setShowAddFeed(!showAddFeed)}
            className="text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            {showAddFeed ? "Annuleren" : "+ Toevoegen"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feeds.length === 0 && !showAddFeed ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">Nog geen agenda&apos;s gekoppeld</p>
            <p className="text-gray-300 text-xs mt-1">
              Voeg een webcal/ICS feed toe van je Microsoft of Apple agenda
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {feeds.map((feed) => (
              <div key={feed.id} className="flex items-center gap-3 py-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: feed.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{feed.name}</p>
                  <p className="text-xs text-gray-400 truncate">{feed.url}</p>
                </div>
                <span className="text-xs text-gray-300">
                  {MAIN_FOLDERS.find((f) => f.id === feed.folder)?.label}
                </span>
                <button
                  onClick={() => toggleFeed(feed.id, !feed.enabled)}
                  className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                    feed.enabled ? "bg-violet-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      feed.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <button
                  onClick={() => deleteFeed(feed.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add feed form */}
        {showAddFeed && (
          <form onSubmit={addFeed} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <input
              type="text"
              placeholder="Naam (bijv. Werk agenda)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
            />
            <input
              type="url"
              placeholder="webcal:// of https:// ICS feed URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Map</label>
                <select
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {MAIN_FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kleur</label>
                <div className="flex gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        newColor === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1.5">
              <p className="font-medium text-gray-700">Hoe vind ik mijn agenda-URL?</p>
              <p>
                <span className="font-medium">Microsoft/Outlook:</span> Instellingen → Agenda →
                Gedeelde agenda&apos;s → Agenda publiceren → ICS-koppeling kopiëren
              </p>
              <p>
                <span className="font-medium">Apple Calendar:</span> Rechtermuisknop op agenda →
                Deel agenda → link kopiëren (begint met webcal://)
              </p>
            </div>

            <button
              type="submit"
              disabled={!newName.trim() || !newUrl.trim()}
              className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Agenda toevoegen
            </button>
          </form>
        )}
      </div>

      {/* Events display */}
      {eventsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : Object.keys(eventsByDay).length === 0 ? (
        feeds.length > 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Geen events komende 2 weken</p>
          </div>
        ) : null
      ) : (
        <div className="space-y-6">
          {Object.entries(eventsByDay).map(([day, dayEvents]) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 capitalize">
                {day}
              </h2>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div
                    key={event.uid}
                    className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm"
                  >
                    <span
                      className="w-1 h-full min-h-[2rem] rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: event.feedColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.summary}</p>
                      {event.location && (
                        <p className="text-xs text-gray-500 mt-0.5">{event.location}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {event.allDay ? (
                          <span className="text-xs text-gray-400">Hele dag</span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {new Date(event.start).toLocaleTimeString("nl-NL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {event.end && (
                              <>
                                {" – "}
                                {new Date(event.end).toLocaleTimeString("nl-NL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            )}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">{event.feedName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
