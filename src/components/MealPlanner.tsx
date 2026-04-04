"use client";

import { useState } from "react";

interface MealDay {
  dag: string;
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

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  snel: { bg: "bg-amber-100", text: "text-amber-800", label: "Snel!" },
  vrij: { bg: "bg-purple-100", text: "text-purple-800", label: "Man kookt" },
  frietjes: { bg: "bg-pink-100", text: "text-pink-800", label: "Frietjes!" },
  bonus: { bg: "bg-green-100", text: "text-green-800", label: "Bonus" },
  prep: { bg: "bg-blue-100", text: "text-blue-800", label: "Prep dag" },
};

export default function MealPlanner() {
  const [bonus, setBonus] = useState("");
  const [boerschappen, setBoerschappen] = useState("");
  const [voorraad, setVoorraad] = useState("");
  const [vrijeDag, setVrijeDag] = useState("maandag");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MealPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggleChecked = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setChecked({});

    try {
      const res = await fetch("/api/meal-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonus, boerschappen, voorraad, vrijeDag }),
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

  function reset() {
    setResult(null);
    setBonus("");
    setBoerschappen("");
    setVoorraad("");
    setError(null);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Maaltijdplanner</h1>
        <p className="text-gray-500 mt-1">
          Vul in wat er in de bonus is — je weekmenu staat in 30 seconden klaar
        </p>
      </div>

      {!result && !loading && (
        <div className="space-y-4">
          {/* AH Bonus */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">AH Bonusaanbiedingen</h3>
            <p className="text-xs text-gray-400 mb-3">Wat staat er in de bonus deze week? (vlees, vis, groenten)</p>
            <textarea
              placeholder="bijv. zalmfilets 50% korting, kipfilet bonus, paprika aanbieding..."
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-sm resize-none bg-gray-50"
            />
          </div>

          {/* Boerschappen */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Boerschappen box</h3>
            <p className="text-xs text-gray-400 mb-3">Wat zit er in de box? Leeg laten als je geen box hebt.</p>
            <textarea
              placeholder="bijv. boerenkool, aardappels, wortelen, verse kruiden..."
              value={boerschappen}
              onChange={(e) => setBoerschappen(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-sm resize-none bg-gray-50"
            />
          </div>

          {/* Voorraad */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Wat heb je al in huis?</h3>
            <p className="text-xs text-gray-400 mb-3">Vriezer, koelkast, of iets wat op moet.</p>
            <textarea
              placeholder="bijv. gehakt in vriezer, halve courgette, blik tonijn x2..."
              value={voorraad}
              onChange={(e) => setVoorraad(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400 text-sm resize-none bg-gray-50"
            />
          </div>

          {/* Vrije dag */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Vrije dag voor je man</h3>
            <p className="text-xs text-gray-400 mb-3">Hij kookt zelf of maakt AVG op deze dag.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setVrijeDag("maandag")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  vrijeDag === "maandag"
                    ? "bg-green-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Maandag
              </button>
              <button
                onClick={() => setVrijeDag("donderdag")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  vrijeDag === "donderdag"
                    ? "bg-green-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Donderdag
              </button>
            </div>
          </div>

          <button
            onClick={generate}
            className="w-full py-4 bg-green-700 text-white rounded-2xl hover:bg-green-800 transition-colors shadow-lg shadow-green-700/20 font-medium text-base"
          >
            Genereer mijn weekmenu
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Menu wordt gegenereerd...</p>
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
                  <span className="text-sm font-semibold text-green-800 w-20 flex-shrink-0 pt-0.5">
                    {dag.dag}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{dag.maaltijd}</p>
                    {dag.notitie && (
                      <p className="text-xs text-gray-500 mt-0.5">{dag.notitie}</p>
                    )}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
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
