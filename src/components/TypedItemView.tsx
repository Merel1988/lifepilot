"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MAIN_FOLDERS } from "@/lib/folders";
import {
  type Item,
  isRecurringToday,
  isCompletedForDate,
  getTodayDateString,
  recurringMatchesTimeFolder,
} from "@/lib/types";
import ItemCard from "./ItemCard";
import CreateItemModal from "./CreateItemModal";
import EditItemModal from "./EditItemModal";

interface TypedItemViewProps {
  type: "TASK" | "REMINDER" | "NOTE";
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
};

export default function TypedItemView({ type, title, description }: TypedItemViewProps) {
  const searchParams = useSearchParams();
  const timeFilter = searchParams.get("tijd");
  const [sections, setSections] = useState<TimeSection[]>([]);
  const [completedItems, setCompletedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ type, includeRecurring: "true" });
      if (folderFilter) params.set("folder", folderFilter);
      const res = await fetch(`/api/items?${params}`, { cache: "no-store" });
      const allItems: Item[] = await res.json();

      const todayStr = getTodayDateString();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

      // Separate active vs completed
      const active = allItems.filter((item) => {
        if (item.recurring) return !isCompletedForDate(item, todayStr);
        return !item.completed;
      });
      const completed = allItems.filter((item) => {
        if (item.recurring) return isCompletedForDate(item, todayStr);
        return item.completed;
      });

      if (type === "NOTE") {
        // Notes don't have time grouping, just show them all
        const result: TimeSection[] = [];
        if (active.length > 0) {
          result.push({ id: "all", label: "Alle notities", items: active });
        }
        setSections(result);
        setCompletedItems(completed);
        return;
      }

      // Group by time period
      const overdue: Item[] = [];
      const todayItems: Item[] = [];
      const weekItems: Item[] = [];
      const monthItems: Item[] = [];
      const yearItems: Item[] = [];
      const laterItems: Item[] = [];

      for (const item of active) {
        if (item.recurring) {
          if (isRecurringToday(item)) todayItems.push(item);
          else if (recurringMatchesTimeFolder(item, "deze-week")) weekItems.push(item);
          continue;
        }

        if (!item.date) {
          laterItems.push(item);
          continue;
        }

        const d = new Date(item.date);
        const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (itemDate < today) overdue.push(item);
        else if (itemDate <= todayEnd) todayItems.push(item);
        else if (itemDate <= endOfWeek) weekItems.push(item);
        else if (itemDate <= endOfMonth) monthItems.push(item);
        else if (itemDate <= endOfYear) yearItems.push(item);
        else laterItems.push(item);
      }

      const result: TimeSection[] = [];
      if (overdue.length > 0) result.push({ id: "overdue", label: "Achterstallig", items: overdue });
      if (todayItems.length > 0) result.push({ id: "today", label: "Vandaag", items: todayItems });
      if (weekItems.length > 0) result.push({ id: "week", label: "Deze week", items: weekItems });
      if (monthItems.length > 0) result.push({ id: "month", label: "Deze maand", items: monthItems });
      if (yearItems.length > 0) result.push({ id: "year", label: "Dit jaar", items: yearItems });
      if (laterItems.length > 0) result.push({ id: "later", label: "Ooit", items: laterItems });

      setSections(result);
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
    fetchItems(true);
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

      {/* Folder filter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setFolderFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            folderFilter === null
              ? "bg-blue-600 text-white"
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
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowCreate(true)}
        className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 font-medium text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nieuw item
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalItems === 0 && completedItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Geen items gevonden</p>
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
        onClose={() => setShowCreate(false)}
        onCreated={fetchItems}
        defaultType={type}
      />

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={fetchItems}
      />
    </div>
  );
}
