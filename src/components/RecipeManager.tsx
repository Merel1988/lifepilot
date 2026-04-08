"use client";

import { useState, useEffect, useCallback } from "react";

interface Recipe {
  id: string;
  title: string;
  category: string;
  ingredients: string | null;
  description: string | null;
  source: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { id: "ONTBIJT", label: "Ontbijt" },
  { id: "LUNCH", label: "Lunch" },
  { id: "AVONDETEN", label: "Avondeten" },
  { id: "OVERIG", label: "Overig" },
];

const CATEGORY_COLORS: Record<string, string> = {
  ONTBIJT: "bg-amber-100 text-amber-800",
  LUNCH: "bg-blue-100 text-blue-800",
  AVONDETEN: "bg-green-100 text-green-800",
  OVERIG: "bg-gray-100 text-gray-800",
};

export default function RecipeManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("AVONDETEN");
  const [ingredients, setIngredients] = useState("");
  const [description, setDescription] = useState("");

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/recipes?category=${filter}` : "/api/recipes";
      const res = await fetch(url, { cache: "no-store" });
      setRecipes(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  function openNew() {
    setEditingId(null);
    setTitle("");
    setCategory("AVONDETEN");
    setIngredients("");
    setDescription("");
    setShowForm(true);
  }

  function openEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setTitle(recipe.title);
    setCategory(recipe.category);
    setIngredients(recipe.ingredients || "");
    setDescription(recipe.description || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title,
      category,
      ingredients: ingredients || null,
      description: description || null,
    };

    if (editingId) {
      await fetch(`/api/recipes/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source: "manual" }),
      });
    }

    setShowForm(false);
    fetchRecipes();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    fetchRecipes();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Favoriete recepten</h1>
        <p className="text-gray-500 mt-1">
          Bewaar je lievelingsrecepten — ze worden meegenomen in de maaltijdplanner
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            filter === null
              ? "bg-green-700 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Alles
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === cat.id
                ? "bg-green-700 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={openNew}
        className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-3 bg-green-700 text-white rounded-2xl hover:bg-green-800 transition-colors shadow-lg shadow-green-700/20 font-medium text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Nieuw recept
      </button>

      {/* Recipe list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {filter ? "Geen recepten in deze categorie" : "Nog geen recepten opgeslagen"}
          </p>
          <p className="text-gray-300 text-sm mt-1">
            Voeg ze hier toe of markeer ze vanuit de maaltijdplanner
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => openEdit(recipe)}
              className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-gray-200 cursor-pointer transition-all"
            >
              <span className="text-red-400 mt-0.5 flex-shrink-0">♥</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{recipe.title}</p>
                {recipe.ingredients && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{recipe.ingredients}</p>
                )}
                {recipe.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.OVERIG}`}>
                    {CATEGORIES.find((c) => c.id === recipe.category)?.label || recipe.category}
                  </span>
                  {recipe.source === "mealplan" && (
                    <span className="text-xs text-gray-300">uit maaltijdplanner</span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id); }}
                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Recept bewerken" : "Nieuw recept"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    &times;
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Naam van het recept"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 placeholder-gray-400"
                  autoFocus
                />

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categorie</label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          category === cat.id
                            ? "bg-green-700 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ingrediënten</label>
                  <textarea
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="bijv. kipfilet, paprika, rijst, sojasaus..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bereiding / notities</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Optionele bereidingswijze of notities..."
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 p-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-700 rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingId ? "Opslaan" : "Toevoegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
