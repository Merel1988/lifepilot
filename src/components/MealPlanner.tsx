"use client";

import { useState, useRef, useEffect } from "react";

interface MealDay {
  dag: string;
  type?: string; // ontbijt / lunch / avondeten
  maaltijd: string;
  notitie?: string;
  badge?: string | null;
  bonus_item?: boolean;
  // Alleen in mealprep-weken
  porties?: number;
  kookmoment?: string;
  bewaaradvies?: string;
}

interface PrepGroep {
  dag: string;
  stappen: string[];
}

interface MealPlanResult {
  week_titel: string;
  dagen: MealDay[];
  prep?: PrepGroep[];
  zondag_prep?: string[]; // oudere menu's
  boodschappenlijst?: string[];
}

interface Recipe {
  id: string;
  title: string;
  category: string;
  ingredients: string | null;
}

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  snel: { bg: "bg-amber-100", text: "text-amber-800", label: "Snel!" },
  frietjes: { bg: "bg-pink-100", text: "text-pink-800", label: "Frietjes!" },
  bonus: { bg: "bg-green-100", text: "text-green-800", label: "Bonus" },
  prep: { bg: "bg-violet-100", text: "text-violet-800", label: "Prep dag" },
  restjes: { bg: "bg-orange-100", text: "text-orange-800", label: "Restjesdag" },
  favoriet: { bg: "bg-red-100", text: "text-red-800", label: "Favoriet" },
};

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MEAL_TYPES = [
  { id: "ontbijt", label: "Ontbijt" },
  { id: "lunch", label: "Lunch" },
  { id: "avondeten", label: "Avondeten" },
];

type MealGrid = Record<string, Record<string, boolean>>;

/**
 * Restjes en frietjes zijn gewoontes, geen wetten: ze staan aan of uit en de
 * dag is vrij te kiezen. Wat hier aanstaat wordt door de server als vaste dag
 * doorgegeven; wat uitstaat bestaat voor het menu niet.
 */
interface Gewoonte {
  id: string;
  label: string;
  letter: string;
  gerecht: string;
  notitie: string | null;
  badge: string;
  maaltijd: string;
  aan: boolean;
  dag: string;
}

const DEFAULT_GEWOONTES: Gewoonte[] = [
  {
    id: "restjes",
    label: "Restjesdag",
    letter: "R",
    gerecht: "Restjes van de week",
    notitie: null,
    badge: "restjes",
    maaltijd: "avondeten",
    aan: true,
    dag: "Donderdag",
  },
  {
    id: "frietjes",
    label: "Frietjesdag",
    letter: "F",
    gerecht: "Frietjes",
    notitie: "Met snack naar keuze",
    badge: "frietjes",
    maaltijd: "avondeten",
    aan: true,
    dag: "Vrijdag",
  },
];

// Standaard: elke avond een menu. Wat je niet wilt laten plannen zet je uit —
// de app gokt niet meer welke avonden dat zijn.
function getDefaultMealGrid(): MealGrid {
  const grid: MealGrid = {};
  for (const day of DAYS) {
    grid[day] = { ontbijt: false, lunch: false, avondeten: true };
  }
  return grid;
}

interface Instellingen {
  mealGrid: MealGrid;
  gewoontes: { id: string; aan: boolean; dag: string }[];
  mealprep: { aan: boolean; aantalGerechten: number; porties: number };
}

/** Losse velden uit een bewaarde instelling terugzetten, zonder te vertrouwen op de vorm. */
function mergeInstellingen(raw: unknown): Partial<Instellingen> {
  if (!raw || typeof raw !== "object") return {};
  const v = raw as Partial<Instellingen>;
  const out: Partial<Instellingen> = {};

  if (v.mealGrid && typeof v.mealGrid === "object") {
    const grid = getDefaultMealGrid();
    for (const day of DAYS) {
      for (const meal of MEAL_TYPES) {
        const val = v.mealGrid[day]?.[meal.id];
        if (typeof val === "boolean") grid[day][meal.id] = val;
      }
    }
    out.mealGrid = grid;
  }

  if (Array.isArray(v.gewoontes)) out.gewoontes = v.gewoontes;

  if (v.mealprep && typeof v.mealprep === "object") {
    out.mealprep = {
      aan: v.mealprep.aan === true,
      aantalGerechten: Number(v.mealprep.aantalGerechten) || 3,
      porties: Number(v.mealprep.porties) || 4,
    };
  }

  return out;
}

interface PantryItem {
  id: string;
  name: string;
}

export default function MealPlanner() {
  const [persoonlijkeBonus, setPersoonlijkeBonus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MealPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [mealGrid, setMealGrid] = useState(getDefaultMealGrid);
  const [gewoontes, setGewoontes] = useState<Gewoonte[]>(DEFAULT_GEWOONTES);
  const [mealprepAan, setMealprepAan] = useState(false);
  const [aantalGerechten, setAantalGerechten] = useState(3);
  const [porties, setPorties] = useState(4);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingRecipe, setSavingRecipe] = useState<number | null>(null);

  // AH Bonus
  const [ahBonus, setAhBonus] = useState<string>("");
  const [ahLoading, setAhLoading] = useState(false);
  const [ahFetched, setAhFetched] = useState(false);

  // Favorite recipes
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // Persistent pantry
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [newPantryItem, setNewPantryItem] = useState("");
  const [extraVoorraad, setExtraVoorraad] = useState("");

  useEffect(() => {
    fetch("/api/recipes?favorite=true", { cache: "no-store" }).then((r) => r.json()).then(setRecipes).catch(() => {});
    fetch("/api/pantry", { cache: "no-store" }).then((r) => r.json()).then(setPantry).catch(() => {});

    // Begin waar vorige week eindigde in plaats van bij een standaardaanname
    fetch("/api/meal-plan/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { instellingen?: unknown }) => {
        const vorige = mergeInstellingen(data.instellingen);
        if (vorige.mealGrid) setMealGrid(vorige.mealGrid);
        if (vorige.gewoontes) {
          setGewoontes((prev) =>
            prev.map((g) => {
              const bewaard = vorige.gewoontes?.find((b) => b.id === g.id);
              if (!bewaard) return g;
              return {
                ...g,
                aan: bewaard.aan === true,
                dag: DAYS.includes(bewaard.dag) ? bewaard.dag : g.dag,
              };
            })
          );
        }
        if (vorige.mealprep) {
          setMealprepAan(vorige.mealprep.aan);
          setAantalGerechten(vorige.mealprep.aantalGerechten);
          setPorties(vorige.mealprep.porties);
        }
      })
      .catch(() => {});
  }, []);

  async function addPantryItems() {
    const names = newPantryItem.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    const res = await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    const created = await res.json();
    setPantry((prev) => [...created, ...prev]);
    setNewPantryItem("");
  }

  async function removePantryItem(id: string) {
    await fetch("/api/pantry", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPantry((prev) => prev.filter((p) => p.id !== id));
  }

  const toggleChecked = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  function toggleMeal(day: string, meal: string) {
    setMealGrid((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] },
    }));
  }

  /** De gewoonte die deze dag/maaltijd al bezet houdt, of niets. */
  function gewoonteVoor(day: string, meal: string): Gewoonte | undefined {
    return gewoontes.find((g) => g.aan && g.dag === day && g.maaltijd === meal);
  }

  function toggleGewoonte(id: string) {
    setGewoontes((prev) => prev.map((g) => (g.id === id ? { ...g, aan: !g.aan } : g)));
  }

  function setGewoonteDag(id: string, dag: string) {
    setGewoontes((prev) => prev.map((g) => (g.id === id ? { ...g, dag } : g)));
  }

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function fetchAHBonus() {
    setAhLoading(true);
    try {
      const res = await fetch("/api/ah-bonus", { cache: "no-store" });
      const data = await res.json();
      if (data.products && data.products.length > 0) {
        const bonusText = data.products
          .map((p: { title: string; discount: string }) =>
            p.discount ? `${p.title} (${p.discount})` : p.title
          )
          .join("\n");
        setAhBonus(bonusText);
        setAhFetched(true);
      } else {
        setAhBonus("");
        setAhFetched(true);
        setError(data.error || "Geen bonusproducten gevonden. Vul handmatig in.");
      }
    } catch {
      setError("Kon AH bonus niet ophalen. Vul handmatig in.");
    }
    setAhLoading(false);
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // Remove data:...;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setChecked({});

    try {
      // Convert photos to base64
      const photoData: { base64: string; mediaType: string }[] = [];
      for (const photo of photos) {
        const base64 = await fileToBase64(photo.file);
        photoData.push({
          base64,
          mediaType: photo.file.type || "image/jpeg",
        });
      }

      const res = await fetch("/api/meal-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ahBonus,
          persoonlijkeBonus,
          voorraad: [
            ...pantry.map((p) => p.name),
            ...extraVoorraad.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          ].join(", "),
          mealGrid,
          gewoontes: gewoontes
            .filter((g) => g.aan)
            .map((g) => ({
              dag: g.dag,
              maaltijd: g.maaltijd,
              gerecht: g.gerecht,
              notitie: g.notitie,
              badge: g.badge,
            })),
          mealprep: { aan: mealprepAan, aantalGerechten: gerechtenNoemer, porties },
          photos: photoData,
          recipes: recipes.map((r) => ({
            title: r.title,
            category: r.category,
            ingredients: r.ingredients,
          })),
          // Gaat mee zodat het formulier volgende week hier weer begint
          instellingen: {
            mealGrid,
            gewoontes: gewoontes.map((g) => ({ id: g.id, aan: g.aan, dag: g.dag })),
            mealprep: { aan: mealprepAan, aantalGerechten: gerechtenNoemer, porties },
          },
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Er ging iets mis bij het genereren. Probeer het opnieuw.");
    }
    setLoading(false);
  }

  async function saveAsRecipe(dag: MealDay, index: number) {
    setSavingRecipe(index);
    try {
      const category = dag.type === "ontbijt" ? "ONTBIJT" : dag.type === "lunch" ? "LUNCH" : "AVONDETEN";
      await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dag.maaltijd,
          category,
          description: dag.notitie || null,
          favorite: true,
          source: "mealplan",
        }),
      });
      // Refresh favorites list
      const res = await fetch("/api/recipes?favorite=true", { cache: "no-store" });
      setRecipes(await res.json());
    } catch {
      // Silently fail
    }
    setSavingRecipe(null);
  }

  function reset() {
    setResult(null);
    setAhBonus("");
    setPersoonlijkeBonus("");
    setExtraVoorraad("");
    setError(null);
    setAhFetched(false);
    setPhotos([]);
    // Pantry is NOT reset — it persists between sessions
  }

  // Wat het model écht moet bedenken: aangevinkte maaltijden minus de dagen die
  // een gewoonte al bezet houdt.
  const totalMeals = DAYS.reduce(
    (sum, day) =>
      sum +
      MEAL_TYPES.filter((m) => mealGrid[day]?.[m.id] && !gewoonteVoor(day, m.id)).length,
    0
  );
  const actieveGewoontes = gewoontes.filter((g) => g.aan);
  const maxGerechten = Math.max(1, totalMeals);
  const gerechtenNoemer = Math.min(aantalGerechten, maxGerechten);

  // Nieuwe menu's leveren prep-groepen per dag; oudere alleen een zondaglijst.
  const prepGroepen: PrepGroep[] =
    result?.prep && result.prep.length > 0
      ? result.prep.filter((g) => g?.dag && g.stappen?.length > 0)
      : result?.zondag_prep && result.zondag_prep.length > 0
        ? [{ dag: "Zondag", stappen: result.zondag_prep }]
        : [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Maaltijdplanner</h1>
        <p className="text-gray-500 mt-1">
          Kies je maaltijden, vul de bonus in — weekmenu staat in 30 seconden klaar
        </p>
      </div>

      {!result && !loading && (
        <div className="space-y-4">
          {/* Meal grid selector */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Welke maaltijden plannen?</h3>
            <p className="text-xs text-gray-400 mb-3">
              Vink aan wat je deze week wilt laten plannen.
              {actieveGewoontes.length > 0 && (
                <>
                  {" "}
                  {actieveGewoontes
                    .map((g) => `${g.letter} = ${g.label.toLowerCase()}`)
                    .join(", ")}
                  .
                </>
              )}
            </p>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-medium pb-2 pr-2"></th>
                    {DAYS.map((d) => (
                      <th key={d} className="text-center text-gray-400 font-medium pb-2 px-0.5 whitespace-nowrap">
                        {d.slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEAL_TYPES.map((meal) => (
                    <tr key={meal.id}>
                      <td className="text-gray-600 font-medium py-1.5 pr-2 whitespace-nowrap">{meal.label}</td>
                      {DAYS.map((day) => {
                        const gewoonte = gewoonteVoor(day, meal.id);
                        const isOn = mealGrid[day]?.[meal.id];
                        return (
                          <td key={day} className="text-center py-1.5 px-0.5">
                            {gewoonte ? (
                              <span
                                className="inline-block w-7 h-7 leading-7 rounded-lg bg-gray-50 text-gray-400 text-xs"
                                title={`${gewoonte.label}: ${gewoonte.gerecht}`}
                              >
                                {gewoonte.letter}
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleMeal(day, meal.id)}
                                className={`w-7 h-7 rounded-lg transition-colors ${
                                  isOn
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                                }`}
                              >
                                {isOn ? "✓" : ""}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {totalMeals} {totalMeals === 1 ? "maaltijd" : "maaltijden"} te plannen
              {actieveGewoontes.length > 0 &&
                ` + ${actieveGewoontes.length} vaste ${
                  actieveGewoontes.length === 1 ? "dag" : "dagen"
                }`}
            </p>
          </div>

          {/* Gewoontes: vaste dagen zijn optioneel en verplaatsbaar */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Vaste dagen</h3>
            <p className="text-xs text-gray-400 mb-3">
              Gewoontes, geen wetten. Zet uit wat deze week niet uitkomt of schuif het naar een andere dag.
            </p>

            <div className="space-y-2">
              {gewoontes.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleGewoonte(g.id)}
                    className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                      g.aan ? "bg-green-600" : "bg-gray-200"
                    }`}
                    role="switch"
                    aria-checked={g.aan}
                    aria-label={g.label}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        g.aan ? "left-[1.125rem]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${g.aan ? "text-gray-900" : "text-gray-400"}`}>
                      {g.label}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{g.gerecht}</p>
                  </div>
                  <select
                    value={g.dag}
                    onChange={(e) => setGewoonteDag(g.id, e.target.value)}
                    disabled={!g.aan}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Mealprep */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMealprepAan((v) => !v)}
                className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                  mealprepAan ? "bg-green-600" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={mealprepAan}
                aria-label="Mealprep"
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    mealprepAan ? "left-[1.125rem]" : "left-0.5"
                  }`}
                />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Mealprep</h3>
                <p className="text-xs text-gray-400">
                  Minder verschillende gerechten voor meer dagen, met porties en bewaaradvies
                </p>
              </div>
            </div>

            {mealprepAan && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 flex-1" htmlFor="aantal-gerechten">
                    Hoeveel verschillende gerechten?
                  </label>
                  <input
                    id="aantal-gerechten"
                    type="number"
                    min={1}
                    max={maxGerechten}
                    value={aantalGerechten}
                    onChange={(e) => setAantalGerechten(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-gray-50 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 flex-1" htmlFor="porties">
                    Porties per maaltijd
                  </label>
                  <input
                    id="porties"
                    type="number"
                    min={1}
                    max={20}
                    value={porties}
                    onChange={(e) => setPorties(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-gray-50 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <p className="text-xs text-green-800 bg-green-50 rounded-lg px-3 py-2">
                  {gerechtenNoemer} {gerechtenNoemer === 1 ? "gerecht" : "gerechten"} voor {totalMeals}{" "}
                  {totalMeals === 1 ? "maaltijd" : "maaltijden"}
                  {porties > 1 && `, ${porties} porties per keer`}
                </p>
              </div>
            )}
          </div>

          {/* AH Bonus */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900">AH Bonusaanbiedingen</h3>
              <button
                onClick={fetchAHBonus}
                disabled={ahLoading}
                className="text-xs font-medium text-green-700 hover:text-green-800 disabled:text-gray-400 flex items-center gap-1"
              >
                {ahLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                    Ophalen...
                  </>
                ) : ahFetched ? (
                  "Opnieuw ophalen"
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Ophalen van ah.nl
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">Automatisch ophalen of handmatig invullen</p>
            <textarea
              placeholder="bijv. zalmfilets 50% korting, kipfilet bonus, paprika aanbieding..."
              value={ahBonus}
              onChange={(e) => setAhBonus(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-sm resize-none bg-gray-50"
            />
          </div>

          {/* Personal bonus */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Persoonlijke bonus</h3>
            <p className="text-xs text-gray-400 mb-3">Jouw persoonlijke AH bonusaanbiedingen die niet online staan</p>
            <textarea
              placeholder="bijv. Griekse yoghurt 1+1 gratis, avocado 30% korting..."
              value={persoonlijkeBonus}
              onChange={(e) => setPersoonlijkeBonus(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-sm resize-none bg-gray-50"
            />
          </div>

          {/* Persistent pantry */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Wat heb je in huis?</h3>
            <p className="text-xs text-gray-400 mb-3">
              Je voorraadlijst wordt bewaard. Streep af wat op is, voeg toe wat erbij komt.
            </p>

            {/* Pantry items */}
            {pantry.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {pantry.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-800 rounded-lg text-xs font-medium group"
                  >
                    {item.name}
                    <button
                      onClick={() => removePantryItem(item.id)}
                      className="text-green-400 hover:text-red-500 transition-colors"
                      title="Verwijderen (op)"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add pantry items */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Toevoegen: gehakt, courgette, tonijn..."
                value={newPantryItem}
                onChange={(e) => setNewPantryItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPantryItems())}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 bg-gray-50"
              />
              <button
                onClick={addPantryItems}
                disabled={!newPantryItem.trim()}
                className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                +
              </button>
            </div>

            {/* Photo upload for extra context */}
            <div className="mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handlePhotos}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-green-400 hover:text-green-700 transition-colors w-full justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Foto van koelkast/voorraadkast
              </button>
            </div>

            {/* Photo previews */}
            {photos.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {photos.map((photo, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img
                      src={photo.preview}
                      alt={`Voorraad foto ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Extra text for items not in pantry */}
            <textarea
              placeholder="Extra items of details (bijv. halve courgette, 2 blikken tonijn)..."
              value={extraVoorraad}
              onChange={(e) => setExtraVoorraad(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-xs resize-none bg-gray-50"
            />
          </div>

          {/* Favorite recipes hint */}
          {recipes.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <span className="text-red-400 text-lg">♥</span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{recipes.length} favoriete recepten</span>{" "}
                  worden meegenomen bij het plannen
                </p>
                <p className="text-xs text-gray-400">
                  Recepten met bonus-ingrediënten krijgen voorrang
                </p>
              </div>
            </div>
          )}

          <button
            onClick={generate}
            disabled={totalMeals === 0}
            className="w-full py-4 bg-green-700 text-white rounded-2xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-700/20 font-medium text-base"
          >
            Genereer mijn weekmenu
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Menu wordt gegenereerd...</p>
          {photos.length > 0 && (
            <p className="text-gray-400 text-xs mt-1">Foto&apos;s worden geanalyseerd...</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mt-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Week overview */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{result.week_titel}</h2>

            <div className="divide-y divide-gray-100">
              {result.dagen?.map((dag, i) => (
                <div key={i} className="py-3 flex gap-3">
                  <div className="flex-shrink-0 w-20 pt-0.5">
                    <span className="text-sm font-semibold text-green-800">
                      {dag.dag}
                    </span>
                    {dag.type && (
                      <span className="block text-xs text-gray-400">{dag.type}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{dag.maaltijd}</p>
                    {dag.notitie && (
                      <p className="text-xs text-gray-500 mt-0.5">{dag.notitie}</p>
                    )}
                    {(dag.kookmoment || dag.porties) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[
                          dag.kookmoment,
                          dag.porties ? `${dag.porties} porties` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {dag.bewaaradvies && (
                      <p className="text-xs text-gray-400 mt-0.5">{dag.bewaaradvies}</p>
                    )}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {dag.badge && dag.badge !== "null" && BADGE_STYLES[dag.badge] && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[dag.badge].bg} ${BADGE_STYLES[dag.badge].text}`}
                        >
                          {BADGE_STYLES[dag.badge].label}
                        </span>
                      )}
                      {dag.bonus_item && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                          Uit bonus
                        </span>
                      )}
                      {/* Save as recipe button */}
                      <button
                        onClick={() => saveAsRecipe(dag, i)}
                        disabled={savingRecipe === i}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
                        title="Opslaan als favoriet recept"
                      >
                        {savingRecipe === i ? "..." : "♥"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prep-momenten. Oudere menu's hebben alleen zondag_prep. */}
          {prepGroepen.map((groep) => (
            <div
              key={groep.dag}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Prep op {groep.dag.toLowerCase()}
              </h3>
              <div className="space-y-2">
                {groep.stappen.map((stap, i) => (
                  <div key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-orange-500 flex-shrink-0">&#x25B8;</span>
                    {stap}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Boodschappenlijst */}
          {result.boodschappenlijst && result.boodschappenlijst.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Boodschappenlijst</h3>
              <div className="space-y-1">
                {result.boodschappenlijst.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleChecked(i)}
                    className={`flex items-center gap-2.5 w-full text-left py-1.5 text-sm transition-colors ${
                      checked[i] ? "text-gray-400 line-through" : "text-gray-700"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        checked[i] ? "bg-green-700 border-green-700" : "border-gray-300"
                      }`}
                    >
                      {checked[i] && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            className="w-full py-3 border-2 border-green-700 text-green-700 rounded-2xl hover:bg-green-50 transition-colors font-medium text-sm"
          >
            Nieuw menu maken
          </button>
        </div>
      )}
    </div>
  );
}
