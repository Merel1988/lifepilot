"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MAIN_FOLDERS, TIME_FOLDERS, getTimeFolderForDate, type MainFolder, type TimeFolder } from "@/lib/folders";
import { type Item, isCompletedForDate, getTodayDateString, recurringMatchesTimeFolder } from "@/lib/types";
import ItemCard from "./ItemCard";
import CreateItemModal from "./CreateItemModal";
import EditItemModal from "./EditItemModal";

interface FolderViewProps {
  folder: MainFolder;
}

export default function FolderView({ folder }: FolderViewProps) {
  const searchParams = useSearchParams();
  const sub = (searchParams.get("sub") as TimeFolder) || "vandaag";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showRecurring, setShowRecurring] = useState(true);

  const hasRecurringToggle = sub === "deze-week" || sub === "deze-maand" || sub === "dit-jaar";

  const mainFolderLabel = MAIN_FOLDERS.find((f) => f.id === folder)?.label ?? folder;
  const subFolderLabel = TIME_FOLDERS.find((f) => f.id === sub)?.label ?? sub;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items?folder=${folder}&includeRecurring=true`, { cache: "no-store" });
      const allItems: Item[] = await res.json();

      const filtered = allItems.filter((item) => {
        if (item.recurring && item.recurrenceDays) {
          return recurringMatchesTimeFolder(item, sub);
        }
        const itemDate = item.date ? new Date(item.date) : null;
        const timeFolder = getTimeFolderForDate(itemDate, item.type);
        return timeFolder === sub;
      });

      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }, [folder, sub]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const handler = () => fetchItems();
    window.addEventListener("item-moved", handler);
    return () => window.removeEventListener("item-moved", handler);
  }, [fetchItems]);

  async function handleToggle(id: string, completed: boolean) {
    const item = items.find((i) => i.id === id);
    if (item?.recurring) {
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
    fetchItems();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    fetchItems();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{mainFolderLabel}</h1>
        <p className="text-gray-500 mt-1">{subFolderLabel}</p>
      </div>

      {/* Sub folder tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {TIME_FOLDERS.map((tf) => {
          const isActive = tf.id === sub;
          return (
            <a
              key={tf.id}
              href={`/folder/${folder}?sub=${tf.id}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tf.label}
            </a>
          );
        })}
      </div>

      {hasRecurringToggle && (
        <button
          onClick={() => setShowRecurring(!showRecurring)}
          className={`flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showRecurring
              ? "bg-purple-100 text-purple-700"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          <span>↻</span>
          Herhalend {showRecurring ? "aan" : "uit"}
        </button>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 font-medium text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nieuw item
      </button>

      {(() => {
        const todayStr = getTodayDateString();
        const visibleItems = hasRecurringToggle && !showRecurring
          ? items.filter((item) => !item.recurring)
          : items;
        const activeItems = visibleItems.filter((item) => {
          if (item.recurring) return !isCompletedForDate(item, todayStr);
          return !item.completed;
        });
        const completedItems = visibleItems.filter((item) => {
          if (item.recurring) return isCompletedForDate(item, todayStr);
          return item.completed;
        });

        return loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeItems.length === 0 && completedItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Geen items in {subFolderLabel.toLowerCase()}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditItem}
              />
            ))}

            {completedItems.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-2"
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
        );
      })()}

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
