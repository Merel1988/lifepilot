"use client";

import { useState, useEffect, useCallback } from "react";

interface HabitCompletion {
  id: string;
  habitId: string;
  date: string;
}

interface Habit {
  id: string;
  name: string;
  color: string;
  frequency: string;
  customDays: string | null;
  archived: boolean;
  completions: HabitCompletion[];
}

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#d946ef", "#ca8a04", "#4f46e5", "#059669",
];

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(getDateStr(d));
  }
  return dates;
}

function shouldShowHabitOnDay(habit: Habit, dayOfWeek: number): boolean {
  if (habit.frequency === "DAILY") return true;
  if (habit.frequency === "WEEKDAYS") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (habit.frequency === "CUSTOM" && habit.customDays) {
    return habit.customDays.split(",").map(Number).includes(dayOfWeek);
  }
  return true;
}

// Generate weeks for history (most recent first)
function getWeeksBack(count: number): { label: string; dates: string[] }[] {
  const weeks: { label: string; dates: string[] }[] = [];
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  for (let w = 0; w < count; w++) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(getDateStr(d));
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const label = w === 0
      ? "Deze week"
      : w === 1
      ? "Vorige week"
      : `${monday.getDate()} ${monday.toLocaleDateString("nl-NL", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("nl-NL", { month: "short" })}`;
    weeks.push({ label, dates });
  }
  return weeks;
}

const DAY_NAMES = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newCustomDays, setNewCustomDays] = useState<number[]>([]);

  // Detail modal
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [historyWeeks, setHistoryWeeks] = useState(8);

  const weekDates = getWeekDates();
  const todayStr = getDateStr(new Date());

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/habits?dateFrom=${weekDates[0]}&dateTo=${weekDates[6]}`
      );
      const data: Habit[] = await res.json();
      setHabits(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  async function openDetail(habit: Habit) {
    setSelectedHabit(habit);
    setEditName(habit.name);

    // Fetch full history (all completions, no date filter)
    const res = await fetch("/api/habits?dateFrom=2020-01-01&dateTo=2099-12-31");
    const allHabits: Habit[] = await res.json();
    const full = allHabits.find((h) => h.id === habit.id);
    setDetailHabit(full || habit);
  }

  function closeDetail() {
    setSelectedHabit(null);
    setDetailHabit(null);
  }

  async function saveHabitName() {
    if (!selectedHabit || !editName.trim() || editName === selectedHabit.name) return;
    setSavingName(true);
    await fetch(`/api/habits/${selectedHabit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setSavingName(false);
    fetchHabits();
    setSelectedHabit({ ...selectedHabit, name: editName });
    if (detailHabit) setDetailHabit({ ...detailHabit, name: editName });
  }

  async function toggleCompletion(habitId: string, date: string) {
    await fetch(`/api/habits/${habitId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    fetchHabits();

    // Also update detail if open
    if (detailHabit && detailHabit.id === habitId) {
      const alreadyDone = detailHabit.completions.some((c) => c.date === date);
      setDetailHabit({
        ...detailHabit,
        completions: alreadyDone
          ? detailHabit.completions.filter((c) => c.date !== date)
          : [...detailHabit.completions, { id: "temp", habitId, date }],
      });
    }
  }

  async function createHabit() {
    if (!newName.trim()) return;
    await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        color: newColor,
        frequency: newFrequency,
        customDays: newFrequency === "CUSTOM" ? newCustomDays.join(",") : null,
      }),
    });
    setNewName("");
    setNewColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setNewFrequency("DAILY");
    setNewCustomDays([]);
    setShowCreate(false);
    fetchHabits();
  }

  async function deleteHabit(id: string) {
    await fetch(`/api/habits/${id}`, { method: "DELETE" });
    fetchHabits();
    if (selectedHabit?.id === id) closeDetail();
  }

  function isCompletedOn(habit: Habit, date: string): boolean {
    return habit.completions.some((c) => c.date === date);
  }

  function getStreak(habit: Habit): number {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = getDateStr(d);
      const dayOfWeek = d.getDay();
      if (!shouldShowHabitOnDay(habit, dayOfWeek)) continue;
      if (habit.completions.some((c) => c.date === dateStr)) {
        streak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  }

  // Week completion dot for a habit
  function renderWeekDot(habit: Habit, date: string) {
    const d = new Date(date + "T12:00:00");
    const dayOfWeek = d.getDay();
    const active = shouldShowHabitOnDay(habit, dayOfWeek);
    const completed = isCompletedOn(habit, date);
    const isToday = date === todayStr;
    const isPast = date < todayStr;

    if (!active) {
      return <span className="w-3 h-0.5 rounded bg-gray-100" />;
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggleCompletion(habit.id, date); }}
        className="flex items-center justify-center"
      >
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
            completed
              ? ""
              : isToday
              ? "border-2 border-dashed"
              : isPast
              ? "bg-red-50"
              : "bg-gray-50"
          }`}
          style={
            completed
              ? { backgroundColor: habit.color }
              : isToday
              ? { borderColor: habit.color + "80" }
              : {}
          }
        >
          {completed && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gewoontes</h1>
          <p className="text-gray-500 mt-1">Bouw goede gewoontes op, dag voor dag</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-gray-400 text-sm mb-4">
              Nog geen gewoontes. Voeg je eerste gewoonte toe!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {habits.map((habit) => {
              const weekCompleted = weekDates.filter((d) => isCompletedOn(habit, d)).length;
              const weekTotal = weekDates.filter((d) => {
                const day = new Date(d + "T12:00:00").getDay();
                return shouldShowHabitOnDay(habit, day);
              }).length;

              return (
                <div
                  key={habit.id}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => openDetail(habit)}
                >
                  {/* Habit name row — always visible */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: habit.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 truncate flex-1">
                      {habit.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {weekCompleted}/{weekTotal}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Week dots row */}
                  <div className="flex items-center gap-0">
                    {weekDates.map((date, i) => (
                      <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                        <span className={`text-[10px] font-medium ${date === todayStr ? "text-blue-600" : "text-gray-300"}`}>
                          {DAY_NAMES[i]}
                        </span>
                        {renderWeekDot(habit, date)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add habit */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium border-t border-gray-100 flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Gewoonte toevoegen
          </button>
        ) : (
          <div className="p-4 border-t border-gray-100 space-y-3">
            <input
              type="text"
              placeholder="Naam van de gewoonte..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && createHabit()}
            />

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Kleur:</span>
              <div className="flex gap-1.5">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {[
                { id: "DAILY", label: "Dagelijks" },
                { id: "WEEKDAYS", label: "Werkdagen" },
                { id: "CUSTOM", label: "Aangepast" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setNewFrequency(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newFrequency === f.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {newFrequency === "CUSTOM" && (
              <div className="flex gap-1.5">
                {[
                  { id: 1, label: "Ma" },
                  { id: 2, label: "Di" },
                  { id: 3, label: "Wo" },
                  { id: 4, label: "Do" },
                  { id: 5, label: "Vr" },
                  { id: 6, label: "Za" },
                  { id: 0, label: "Zo" },
                ].map((day) => {
                  const selected = newCustomDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      onClick={() =>
                        setNewCustomDays((prev) =>
                          selected ? prev.filter((d) => d !== day.id) : [...prev, day.id]
                        )
                      }
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

            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={createHabit}
                disabled={!newName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Toevoegen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Habit detail modal */}
      {selectedHabit && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedHabit.color }}
                  />
                  <h2 className="text-lg font-semibold text-gray-900">Gewoonte</h2>
                </div>
                <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                  &times;
                </button>
              </div>

              {/* Edit name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Naam</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveHabitName()}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {editName !== selectedHabit.name && (
                    <button
                      onClick={saveHabitName}
                      disabled={savingName || !editName.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {savingName ? "..." : "Opslaan"}
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {detailHabit && (
                <div className="flex gap-4">
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{getStreak(detailHabit)}</p>
                    <p className="text-xs text-gray-400">Huidige streak</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{detailHabit.completions.length}</p>
                    <p className="text-xs text-gray-400">Totaal voltooid</p>
                  </div>
                </div>
              )}

              {/* History grid */}
              {detailHabit && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Geschiedenis</h3>
                  <div className="space-y-3">
                    {getWeeksBack(historyWeeks).map((week) => (
                      <div key={week.dates[0]}>
                        <p className="text-xs text-gray-400 mb-1">{week.label}</p>
                        <div className="flex gap-1">
                          {week.dates.map((date, i) => {
                            const d = new Date(date + "T12:00:00");
                            const dayOfWeek = d.getDay();
                            const active = shouldShowHabitOnDay(detailHabit, dayOfWeek);
                            const completed = detailHabit.completions.some((c) => c.date === date);
                            const isFuture = date > todayStr;

                            return (
                              <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-gray-300">{DAY_NAMES[i]}</span>
                                {!active ? (
                                  <span className="w-full h-6 flex items-center justify-center">
                                    <span className="w-3 h-0.5 rounded bg-gray-100" />
                                  </span>
                                ) : isFuture ? (
                                  <span className="w-full h-6 flex items-center justify-center">
                                    <span className="w-6 h-6 rounded-md bg-gray-50" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => toggleCompletion(detailHabit.id, date)}
                                    className="w-full h-6 flex items-center justify-center"
                                  >
                                    <span
                                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                        completed ? "" : "bg-red-50"
                                      }`}
                                      style={completed ? { backgroundColor: detailHabit.color } : {}}
                                    >
                                      {completed && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setHistoryWeeks((w) => w + 8)}
                    className="w-full mt-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Meer laden...
                  </button>
                </div>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteHabit(selectedHabit.id)}
                className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                Gewoonte verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
