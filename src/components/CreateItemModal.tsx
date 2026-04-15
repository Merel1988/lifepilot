"use client";

import { useState } from "react";
import { MAIN_FOLDERS, ITEM_TYPES, getDefaultFolder, type MainFolder, type ItemType } from "@/lib/folders";
import RichTextEditor from "./RichTextEditor";

const DAYS_OF_WEEK = [
  { id: 1, label: "Ma" },
  { id: 2, label: "Di" },
  { id: 3, label: "Wo" },
  { id: 4, label: "Do" },
  { id: 5, label: "Vr" },
  { id: 6, label: "Za" },
  { id: 0, label: "Zo" },
];

interface CreateItemModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultType?: ItemType;
}

export default function CreateItemModal({ open, onClose, onCreated, defaultType }: CreateItemModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType>(defaultType || "TASK");
  const [date, setDate] = useState(today);
  const [folder, setFolder] = useState<MainFolder>(getDefaultFolder());
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; filename: string; mimeType: string; size: number }[]>([]);

  function reset() {
    setTitle("");
    setType("TASK");
    setDate(today);
    setFolder(getDefaultFolder());
    setDescription("");
    setTime("");
    setRecurring(false);
    setRecurrenceDays([]);
    setShowMore(false);
    setAttachments([]);
  }

  function toggleDay(day: number) {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (recurring && recurrenceDays.length === 0) return;

    setSaving(true);
    try {
      const itemDate = type === "NOTE" ? null : recurring ? null : date || null;
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          date: itemDate,
          folder,
          description: description || null,
          time: type === "REMINDER" ? time || null : null,
          recurring,
          recurrenceDays: recurring ? recurrenceDays.join(",") : null,
        }),
      });
      reset();
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nieuw item</h2>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <input
              type="text"
              placeholder="Wat moet er gebeuren?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-900 placeholder-gray-400"
              autoFocus
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ItemType)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
            </div>

            {showMore && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Map</label>
                  <select
                    value={folder}
                    onChange={(e) => setFolder(e.target.value as MainFolder)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                          recurring ? "bg-violet-600" : "bg-gray-200"
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
                                  ? "bg-violet-600 text-white"
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
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    placeholder="Omschrijving, checklist, notities..."
                    onAttachmentUploaded={(att) => setAttachments((prev) => [...prev, att])}
                  />
                </div>

                {/* Attachment list */}
                {attachments.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bijlagen</label>
                    <div className="space-y-1">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="truncate flex-1">{att.filename}</span>
                          <span className="text-xs text-gray-400">{(att.size / 1024).toFixed(0)}KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!showMore && (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                Meer opties
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 p-4 flex gap-3">
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving || (recurring && recurrenceDays.length === 0)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Opslaan..." : "Toevoegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
