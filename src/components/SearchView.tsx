"use client";

import { useState, useCallback } from "react";
import { type Item, getTodayDateString } from "@/lib/types";
import ItemCard from "./ItemCard";
import EditItemModal from "./EditItemModal";

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(q)}&includeRecurring=true`);
      const items: Item[] = await res.json();
      setResults(items);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      search(query);
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    const item = results.find((i) => i.id === id);
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
    search(query);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    search(query);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zoeken</h1>
      </div>

      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zoek op titel..."
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 text-sm shadow-sm"
          autoFocus
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Geen resultaten voor &ldquo;{query}&rdquo;</p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-3">{results.length} resultaat{results.length !== 1 ? "en" : ""}</p>
          {results.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={setEditItem}
            />
          ))}
        </div>
      ) : !searched ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">Typ een zoekterm en druk op Enter</p>
        </div>
      ) : null}

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={() => search(query)}
      />
    </div>
  );
}
