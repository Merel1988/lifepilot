"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MAIN_FOLDERS, type ItemType } from "@/lib/folders";
import { bucketFor, itemDay, localDay } from "@/lib/day";
import {
  type Item,
  isRecurringToday,
  isCompletedForDate,
  getTodayDateString,
  recurringMatchesTimeFolder,
} from "@/lib/types";
import ItemCard from "./ItemCard";
import CreateItemModal from "./CreateItemModal";
import QuickAdd from "./QuickAdd";
import EditItemModal from "./EditItemModal";

interface ItemListViewProps {
  /** "ALLE" is de lijst uit het menu; de losse types zijn nog los te bekijken. */
  type: ItemType | "ALLE";
  title: string;
  description: string;
}

interface TimeSection {
  id: string;
  label: string;
  items: Item[];
}

const TIME_SECTION_MAP: Record<string, string> = {
  vandaag: "today",
  "deze-week": "week",
  "deze-maand": "month",
  "dit-jaar": "year",
  ooit: "later",
  notities: "notes",
};

export default function ItemListView({ type, title, description }: ItemListViewProps) {
  const searchParams = useSearchParams();
  const timeFilter = searchParams.get("tijd");
  const [sections, setSections] = useState<TimeSection[]>([]);
  const [completedItems, setCompletedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ includeRecurring: "true" });
      if (type !== "ALLE") params.set("type", type);
      if (folderFilter) params.set("folder", folderFilter);
      const res = await fetch(`/api/items?${params}`, { cache: "no-store" });
      const allItems: Item[] = await res.json();

      const today = getTodayDateString();

      // Actief versus afgerond; een herhalend item is "af" per dag
      const active = allItems.filter((item) =>
        item.recurring ? !isCompletedForDate(item, today) : !item.completed
      );
      const completed = allItems.filter((item) =>
        item.recurring ? isCompletedForDate(item, today) : item.completed
      );

      if (type === "NOTE") {
        // Notities hebben geen datum, dus ook geen tijdvakken
        setSections(active.length > 0 ? [{ id: "notes", label: "Alle notities", items: active }] : []);
        setCompletedItems(completed);
        return;
      }

      const buckets: Record<string, Item[]> = {
        overdue: [],
        today: [],
        week: [],
        month: [],
        year: [],
        later: [],
        notes: [],
      };

      // De tijdindeling komt uit lib/day.ts, net als de badges en de ochtendkaart
      for (const item of active) {
        if (item.type === "NOTE") {
          buckets.notes.push(item);
          continue;
        }

        if (item.recurring) {
          if (isRecurringToday(item)) buckets.today.push(item);
          else if (recurringMatchesTimeFolder(item, "deze-week")) buckets.week.push(item);
          continue;
        }

        buckets[bucketFor(itemDay(item.date), localDay())].push(item);
      }

      const labels: [string, string][] = [
        ["overdue", "Achterstallig"],
        ["today", "Vandaag"],
        ["week", "Deze week"],
        ["month", "Deze maand"],
        ["year", "Dit jaar"],
        ["later", "Ooit"],
        ["notes", "Notities"],
      ];

      setSections(
        labels
          .filter(([id]) => buckets[id].length > 0)
          .map(([id, label]) => ({ id, label, items: buckets[id] }))
      );
      setCompletedItems(completed);
    } finally {
      setLoading(false);
    }
  }, [type, folderFilter]);

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

    // Optimistic update
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

    if (item.recurring) {
      await fetch(`/api/items/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getTodayDateString() }),
      });
    } else {
      await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
    }
    fetchItems(true);
    window.dispatchEvent(new CustomEvent("item-moved"));
  }

  async function handleDelete(id: string) {
    setSections((prev) =>
      prev
        .map((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
        .filter((s) => s.items.length > 0)
    );
    setCompletedItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    fetchItems(true);
    window.dispatchEvent(new CustomEvent("item-moved"));
  }

  const visibleSections = timeFilter
    ? sections.filter((s) => s.id === TIME_SECTION_MAP[timeFilter])
    : sections;
  const totalItems = visibleSections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 mt-1">{description}</p>
      </div>

      {/* Verversen na toevoegen loopt via het item-moved event hierboven */}
      <QuickAdd
        defaultType={type === "ALLE" ? undefined : type}
        onMoreFields={(text) => {
          setModalTitle(text);
          setShowCreate(true);
        }}
      />

      {/* Categoriefilter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setFolderFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            folderFilter === null
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Alles
        </button>
        {MAIN_FOLDERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFolderFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              folderFilter === f.id
                ? "bg-violet-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalItems === 0 && completedItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Nog niets hier — typ het hierboven in.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <div key={section.id}>
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
                {completedItems.length} afgerond
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
        onClose={() => {
          setShowCreate(false);
          setModalTitle("");
        }}
        onCreated={fetchItems}
        defaultType={type === "ALLE" ? "TASK" : type}
        defaultTitle={modalTitle}
      />

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={fetchItems}
      />
    </div>
  );
}
