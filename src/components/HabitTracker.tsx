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

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getWeekDates(): string[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
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

const DAY_NAMES = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newFrequency, setNewFrequency] = useState("DAILY");
  const [newCustomDays, setNewCustomDays] = useState<number[]>([]);

  const weekDates = getWeekDates();
  const todayStr = getTodayStr();

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

  async function toggleCompletion(habitId: string, date: string) {
    await fetch(`/api/habits/${habitId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    fetchHabits();
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
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayOfWeek = d.getDay();

      if (!shouldShowHabitOnDay(habit, dayOfWeek)) continue;

      if (habit.completions.some((c) => c.date === dateStr)) {
        streak++;
      } else {
        // Skip today if not completed yet
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  }

  // For streaks we need more data — this is a simplified version using available data
  const todayDayOfWeek = new Date().getDay();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gewoontes</h1>
          <p className="text-gray-500 mt-1">Bouw goede gewoontes op, dag voor dag</p>
        </div>
      </div>

      {/* Week grid header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_repeat(7,40px)] gap-0 px-4 py-3 border-b border-gray-100 items-center">
          <span className="text-xs font-medium text-gray-400"></span>
          {weekDates.map((date, i) => {
            const isToday = date === todayStr;
            return (
              <span
                key={date}
                className={`text-xs font-medium text-center ${
                  isToday ? "text-blue-600" : "text-gray-400"
                }`}
              >
                {DAY_NAMES[i]}
              </span>
            );
          })}
        </div>

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
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="grid grid-cols-[1fr_repeat(7,40px)] gap-0 px-4 py-3 items-center group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {habit.name}
                  </span>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 ml-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {weekDates.map((date, i) => {
                  const d = new Date(date + "T12:00:00");
                  const dayOfWeek = d.getDay();
                  const active = shouldShowHabitOnDay(habit, dayOfWeek);
                  const completed = isCompletedOn(habit, date);
                  const isToday = date === todayStr;
                  const isPast = date < todayStr;

                  if (!active) {
                    return (
                      <div key={date} className="flex items-center justify-center">
                        <span className="w-3 h-0.5 rounded bg-gray-100" />
                      </div>
                    );
                  }

                  return (
                    <button
                      key={date}
                      onClick={() => toggleCompletion(habit.id, date)}
                      className="flex items-center justify-center"
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          completed
                            ? ""
                            : isToday
                            ? "border-2 border-dashed"
                            : isPast
                            ? "bg-gray-50"
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
                })}
              </div>
            ))}
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

            {/* Color picker */}
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

            {/* Frequency */}
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
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
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
    </div>
  );
}
