"use client";

import { useState, useEffect, useCallback } from "react";
import { type Item, isRecurringToday, isCompletedForDate, getTodayDateString } from "@/lib/types";
import ItemCard from "./ItemCard";
import CreateItemModal from "./CreateItemModal";
import EditItemModal from "./EditItemModal";

interface Section {
  label: string;
  items: Item[];
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

export default function Dashboard() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [completedItems, setCompletedItems] = useState<Item[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayStr = getTodayDateString();

      // Fetch today's items + recurring
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      const todayRes = await fetch(
        `/api/items?dateFrom=${today.toISOString()}&dateTo=${todayEnd.toISOString()}&completed=false&includeRecurring=true`,
        { cache: "no-store" }
      );
      const todayAll: Item[] = await todayRes.json();

      // Split into regular today items and recurring items for today
      const todayItems = todayAll.filter((i) => !i.recurring);
      const recurringItems = todayAll
        .filter((i) => i.recurring && isRecurringToday(i))
        .filter((i) => !isCompletedForDate(i, todayStr));

      // Fetch overdue items (past dates, not completed, non-recurring)
      const overdueRes = await fetch(
        `/api/items?dateTo=${today.toISOString()}&completed=false`,
        { cache: "no-store" }
      );
      const overdueAll: Item[] = await overdueRes.json();
      const overdueItems = overdueAll.filter(
        (item) => !item.recurring && item.date && new Date(item.date) < today
      );

      const result: Section[] = [];

      if (overdueItems.length > 0) {
        result.push({ label: "Achterstallig", items: overdueItems });
      }

      const todayCombined = [...todayItems, ...recurringItems];
      if (todayCombined.length > 0) {
        result.push({ label: "Vandaag", items: todayCombined });
      }

      const seenIds = new Set([
        ...todayAll.map((i) => i.id),
        ...overdueItems.map((i) => i.id),
      ]);

      // If we have room, fetch this week
      const totalSoFar = todayCombined.length + overdueItems.length;
      if (totalSoFar < 10) {
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);
        const weekRes = await fetch(
          `/api/items?dateFrom=${today.toISOString()}&dateTo=${endOfWeek.toISOString()}&completed=false`,
          { cache: "no-store" }
        );
        const weekItems: Item[] = await weekRes.json();
        const filtered = weekItems.filter((i) => !i.recurring && !seenIds.has(i.id));
        if (filtered.length > 0) {
          result.push({ label: "Deze week", items: filtered });
          filtered.forEach((i) => seenIds.add(i.id));
        }

        // If still room, fetch this month
        if (totalSoFar + filtered.length < 10) {
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
          const monthRes = await fetch(
            `/api/items?dateFrom=${today.toISOString()}&dateTo=${endOfMonth.toISOString()}&completed=false`,
            { cache: "no-store" }
          );
          const monthItems: Item[] = await monthRes.json();
          const filteredMonth = monthItems.filter((i) => !i.recurring && !seenIds.has(i.id));
          if (filteredMonth.length > 0) {
            result.push({ label: "Deze maand", items: filteredMonth });
            filteredMonth.forEach((i) => seenIds.add(i.id));
          }

          // If still room, fetch this year
          if (totalSoFar + filtered.length + filteredMonth.length < 10) {
            const endOfYear = new Date(today.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999);
            const yearRes = await fetch(
              `/api/items?dateFrom=${today.toISOString()}&dateTo=${endOfYear.toISOString()}&completed=false`,
              { cache: "no-store" }
            );
            const yearItems: Item[] = await yearRes.json();
            const filteredYear = yearItems.filter((i) => !i.recurring && !seenIds.has(i.id));
            if (filteredYear.length > 0) {
              result.push({ label: "Dit jaar", items: filteredYear });
            }
          }
        }
      }

      setSections(result);

      // Fetch calendar events for today
      try {
        const folders = ["PRIVE", "WERK", "JANNIE_MEPPEL"];
        const calEvents: CalendarEvent[] = [];
        for (const f of folders) {
          const calRes = await fetch(
            `/api/calendar/${f}?from=${today.toISOString()}&to=${todayEnd.toISOString()}`,
            { cache: "no-store" }
          );
          if (calRes.ok) {
            const calData = await calRes.json();
            calEvents.push(...(calData.events || []));
          }
        }
        calEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setCalendarEvents(calEvents);
      } catch {
        // Calendar fetch is optional
      }

      // Fetch completed items for today
      const completedRes = await fetch(
        `/api/items?dateFrom=${today.toISOString()}&dateTo=${todayEnd.toISOString()}&completed=true`,
        { cache: "no-store" }
      );
      const completedAll: Item[] = await completedRes.json();
      setCompletedItems(completedAll.filter((i) => !i.recurring));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const handler = () => fetchItems(true);
    window.addEventListener("item-moved", handler);
    return () => window.removeEventListener("item-moved", handler);
  }, [fetchItems]);

  async function handleToggle(id: string, completed: boolean) {
    const item = sections.flatMap((s) => s.items).find((i) => i.id === id);
    if (!item) return;

    // Optimistic update: remove from sections, add to completed (or vice versa)
    if (completed) {
      setSections((prev) =>
        prev
          .map((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
          .filter((s) => s.items.length > 0)
      );
      if (!item.recurring) {
        setCompletedItems((prev) => [{ ...item, completed: true }, ...prev]);
      }
    } else {
      setCompletedItems((prev) => prev.filter((i) => i.id !== id));
    }

    // API call in background
    if (item.recurring) {
      const todayStr = getTodayDateString();
      await fetch(`/api/items/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr }),
      });
    } else {
      await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    }
    // Silent refresh to sync state from server
    fetchItems(true);
  }

  async function handleDelete(id: string) {
    // Optimistic update: remove item immediately
    setSections((prev) =>
      prev
        .map((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
        .filter((s) => s.items.length > 0)
    );
    setCompletedItems((prev) => prev.filter((i) => i.id !== id));

    await fetch(`/api/items/${id}`, { method: "DELETE" });
    fetchItems(true);
  }

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";
  const dateStr = now.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{greeting}!</h1>
        <p className="text-gray-500 mt-1 capitalize">{dateStr}</p>
      </div>

      {/* Today's calendar events */}
      {calendarEvents.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Agenda vandaag
          </h2>
          <div className="space-y-2">
            {calendarEvents.map((event) => (
              <div key={event.uid} className="flex items-center gap-3">
                <span
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.feedColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{event.summary}</p>
                  <p className="text-xs text-gray-400">
                    {event.allDay
                      ? "Hele dag"
                      : `${new Date(event.start).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}${event.end ? ` – ${new Date(event.end).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
                <span className="text-xs text-gray-300 flex-shrink-0">{event.feedName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="w-full mb-8 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 font-medium"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nieuw item toevoegen
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalItems === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Alles afgevinkt!</h2>
          <p className="text-gray-500">Je hebt geen openstaande taken. Geniet van je dag!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.label}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {section.label}
              </h2>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={setEditItem}
                  />
                ))}
              </div>
            </div>
          ))}

          {completedItems.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showCompleted ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {completedItems.length} afgerond vandaag
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {completedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={setEditItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CreateItemModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchItems}
      />

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={fetchItems}
      />
    </div>
  );
}
