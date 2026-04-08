"use client";

import { useState, useRef, useEffect } from "react";

interface MealDay {
  dag: string;
  type?: string; // ontbijt / lunch / avondeten
  maaltijd: string;
  notitie?: string;
  badge?: string | null;
  bonus_item?: boolean;
}

interface MealPlanResult {
  week_titel: string;
  dagen: MealDay[];
  zondag_prep?: string[];
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
  prep: { bg: "bg-blue-100", text: "text-blue-800", label: "Prep dag" },
  restjes: { bg: "bg-orange-100", text: "text-orange-800", label: "Restjesdag" },
  favoriet: { bg: "bg-red-100", text: "text-red-800", label: "Favoriet" },
};

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const MEAL_TYPES = [
  { id: "ontbijt", label: "Ontbijt" },
  { id: "lunch", label: "Lunch" },
  { id: "avondeten", label: "Avondeten" },
];

// Default: 5 dinners (not Thu=restjesdag, not Fri=frietjesdag), no breakfast/lunch
function getDefaultMealGrid(): Record<string, Record<string, boolean>> {
  const grid: Record<string, Record<string, boolean>> = {};
  for (const day of DAYS) {
    grid[day] = {
      ontbijt: false,
      lunch: false,
      avondeten: day !== "Donderdag" && day !== "Vrijdag",
    };
  }
  return grid;
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
    fetch("/api/recipes", { cache: "no-store" }).then((r) => r.json()).then(setRecipes).catch(() => {});
    fetch("/api/pantry", { cache: "no-store" }).then((r) => r.json()).then(setPantry).catch(() => {});
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
          photos: photoData,
          recipes: recipes.map((r) => ({
            title: r.title,
            category: r.category,
            ingredients: r.ingredients,
          })),
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
          source: "mealplan",
        }),
      });
      // Refresh recipes list
      const res = await fetch("/api/recipes", { cache: "no-store" });
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

  // Count how many meals are selected
  const totalMeals = Object.values(mealGrid).reduce(
    (sum, day) => sum + Object.values(day).filter(Boolean).length,
    0
  );

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
              Do = restjesdag, Vr = frietjesdag. Vink aan wat je wilt laten plannen.
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
                        const isFixed = meal.id === "avondeten" && (day === "Donderdag" || day === "Vrijdag");
                        const isOn = mealGrid[day]?.[meal.id];
                        return (
                          <td key={day} className="text-center py-1.5 px-0.5">
                            {isFixed ? (
                              <span className="inline-block w-7 h-7 leading-7 rounded-lg bg-gray-50 text-gray-300 text-xs">
                                {day === "Donderdag" ? "R" : "F"}
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
            <p className="text-xs text-gray-400 mt-2">{totalMeals} maaltijden geselecteerd</p>
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

          {/* Zondag prep */}
          {result.zondag_prep && result.zondag_prep.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Zondag prep (~25 min)</h3>
              <div className="space-y-2">
                {result.zondag_prep.map((stap, i) => (
                  <div key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-orange-500 flex-shrink-0">&#x25B8;</span>
                    {stap}
                  </div>
                ))}
              </div>
            </div>
          )}

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
