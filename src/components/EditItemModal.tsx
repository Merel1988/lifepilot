"use client";

import { useState, useEffect } from "react";
import { MAIN_FOLDERS, ITEM_TYPES, type MainFolder, type ItemType } from "@/lib/folders";
import { type Item } from "@/lib/types";

const DAYS_OF_WEEK = [
  { id: 1, label: "Ma" },
  { id: 2, label: "Di" },
  { id: 3, label: "Wo" },
  { id: 4, label: "Do" },
  { id: 5, label: "Vr" },
  { id: 6, label: "Za" },
  { id: 0, label: "Zo" },
];

interface EditItemModalProps {
  item: Item | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditItemModal({ item, onClose, onUpdated }: EditItemModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType>("TASK");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [folder, setFolder] = useState<MainFolder>("PRIVE");
  const [description, setDescription] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setType(item.type as ItemType);
      setDate(item.date ? new Date(item.date).toISOString().split("T")[0] : "");
      setTime(item.time || "");
      setFolder(item.folder as MainFolder);
      setDescription(item.description || "");
      setRecurring(item.recurring);
      setRecurrenceDays(item.recurrenceDays ? item.recurrenceDays.split(",").map(Number) : []);
    }
  }, [item]);

  function toggleDay(day: number) {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !title.trim()) return;

    setSaving(true);
    try {
      const itemDate = type === "NOTE" ? null : recurring ? null : date || null;
      await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          date: itemDate,
          time: type === "REMINDER" ? time || null : null,
          folder,
          description: description || null,
          recurring,
          recurrenceDays: recurring ? recurrenceDays.join(",") : null,
        }),
      });
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Item bewerken</h2>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <input
              type="text"
              placeholder="Wat moet er gebeuren?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
              autoFocus
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              {type !== "NOTE" && !recurring && (
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {type === "REMINDER" && (
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tijd</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Map</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value as MainFolder)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MAIN_FOLDERS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {type !== "NOTE" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecurring(!recurring);
                      if (!recurring) setRecurrenceDays([]);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      recurring ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        recurring ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <label className="text-xs font-medium text-gray-500">Herhalend</label>
                </div>

                {recurring && (
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const selected = recurrenceDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Omschrijving</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optionele omschrijving..."
              />
            </div>
          </div>

          <div className="border-t border-gray-100 p-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving || (recurring && recurrenceDays.length === 0)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
