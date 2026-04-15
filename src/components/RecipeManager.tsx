"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Recipe {
  id: string;
  title: string;
  category: string;
  ingredients: string | null;
  description: string | null;
  servings: number;
  favorite: boolean;
  sourceUrl: string | null;
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
  LUNCH: "bg-violet-100 text-violet-800",
  AVONDETEN: "bg-green-100 text-green-800",
  OVERIG: "bg-gray-100 text-gray-800",
};

export default function RecipeManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("AVONDETEN");
  const [ingredients, setIngredients] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(4);
  const [favorite, setFavorite] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");

  // Import state
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("category", filter);
      if (favOnly) params.set("favorite", "true");
      const url = `/api/recipes${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setRecipes(data);
    } finally {
      setLoading(false);
    }
  }, [filter, favOnly]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  function openNew() {
    setEditingId(null);
    setTitle("");
    setCategory("AVONDETEN");
    setIngredients("");
    setDescription("");
    setServings(4);
    setFavorite(false);
    setSourceUrl("");
    setShowForm(true);
  }

  function openEdit(recipe: Recipe) {
    setEditingId(recipe.id);
    setTitle(recipe.title);
    setCategory(recipe.category);
    setIngredients(recipe.ingredients || "");
    setDescription(recipe.description || "");
    setServings(recipe.servings);
    setFavorite(recipe.favorite);
    setSourceUrl(recipe.sourceUrl || "");
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
      servings,
      favorite,
      sourceUrl: sourceUrl || null,
    };

    const res = editingId
      ? await fetch(`/api/recipes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, source: "manual" }),
        });

    if (!res.ok) return;

    setShowForm(false);
    await fetchRecipes();
  }

  async function handleToggleFavorite(e: React.MouseEvent, recipe: Recipe) {
    e.stopPropagation();
    // Optimistic update
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? { ...r, favorite: !r.favorite } : r))
    );
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !recipe.favorite }),
    });
  }

  async function handleDelete(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");

    try {
      const res = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        setImportError(data.error || "Kon recept niet importeren");
        return;
      }

      const data = await res.json();
      // Pre-fill the form with imported data
      setTitle(data.title || "");
      setCategory(data.category || "AVONDETEN");
      setIngredients(data.ingredients || "");
      setDescription(data.description || "");
      setServings(data.servings || 4);
      setSourceUrl(data.sourceUrl || importUrl);
      setFavorite(false);
      setEditingId(null);
      setShowImport(false);
      setImportUrl("");
      setShowForm(true);
    } catch {
      setImportError("Kon recept niet importeren");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError("");
    setShowImport(false);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/recipes/import-photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setImportError(data.error || "Kon recept niet herkennen");
        setShowImport(true);
        return;
      }

      const data = await res.json();
      setTitle(data.title || "");
      setCategory(data.category || "AVONDETEN");
      setIngredients(data.ingredients || "");
      setDescription(data.description || "");
      setServings(data.servings || 4);
      setSourceUrl("");
      setFavorite(false);
      setEditingId(null);
      setShowForm(true);
    } catch {
      setImportError("Kon recept niet verwerken");
      setShowImport(true);
    } finally {
      setImporting(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Recepten</h1>
        <p className="text-gray-500 mt-1">
          Bewaar je recepten — favorieten worden meegenomen in de maaltijdplanner
        </p>
      </div>

      {/* Category filter + favorites */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            filter === null && !favOnly
              ? "bg-green-700 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Alles
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setFilter(cat.id); setFavOnly(false); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === cat.id
                ? "bg-green-700 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
        <button
          onClick={() => { setFavOnly(!favOnly); setFilter(null); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            favOnly
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          ♥ Favorieten
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={openNew}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-700 text-white rounded-2xl hover:bg-green-800 transition-colors shadow-lg shadow-green-700/20 font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nieuw recept
        </button>
        <button
          onClick={() => { setShowImport(true); setImportError(""); }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-green-700 border-2 border-green-700 rounded-2xl hover:bg-green-50 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Importeren
        </button>
      </div>

      {/* Importing indicator */}
      {importing && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="w-5 h-5 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-green-800">Recept wordt herkend...</span>
        </div>
      )}

      {/* Hidden file input for photo */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImportPhoto}
      />

      {/* Recipe list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {filter || favOnly ? "Geen recepten gevonden" : "Nog geen recepten opgeslagen"}
          </p>
          <p className="text-gray-300 text-sm mt-1">
            Voeg ze toe, importeer via een link, of maak een foto
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
              <button
                onClick={(e) => handleToggleFavorite(e, recipe)}
                className={`mt-0.5 flex-shrink-0 text-lg transition-colors ${
                  recipe.favorite ? "text-red-400 hover:text-red-300" : "text-gray-200 hover:text-red-300"
                }`}
              >
                {recipe.favorite ? "♥" : "♡"}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{recipe.title}</p>
                {recipe.ingredients && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{recipe.ingredients}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.OVERIG}`}>
                    {CATEGORIES.find((c) => c.id === recipe.category)?.label || recipe.category}
                  </span>
                  <span className="text-xs text-gray-400">{recipe.servings}p</span>
                  {recipe.sourceUrl && (
                    <span className="text-xs text-gray-300" title={recipe.sourceUrl}>
                      via link
                    </span>
                  )}
                  {recipe.source === "photo" && (
                    <span className="text-xs text-gray-300">via foto</span>
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

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recept importeren</h2>
                <button
                  onClick={() => setShowImport(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* URL import */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Via link</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://receptensite.nl/recept/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400"
                    onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
                  />
                  <button
                    onClick={handleImportUrl}
                    disabled={!importUrl.trim() || importing}
                    className="px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? "..." : "Haal op"}
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">of</span></div>
              </div>

              {/* Photo import */}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={importing}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700">Maak een foto van een recept</p>
                  <p className="text-xs text-gray-400">Uit een kookboek, tijdschrift, of kaartje</p>
                </div>
              </button>

              {importError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{importError}</p>
              )}
            </div>
          </div>
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

                <div className="flex gap-4">
                  <div className="flex-1">
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
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Aantal personen</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setServings(Math.max(1, servings - 1))}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-medium"
                      >
                        -
                      </button>
                      <span className="text-sm font-medium text-gray-900 w-6 text-center">{servings}</span>
                      <button
                        type="button"
                        onClick={() => setServings(servings + 1)}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center font-medium"
                      >
                        +
                      </button>
                      <span className="text-xs text-gray-400 ml-1">personen</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Favoriet</label>
                    <button
                      type="button"
                      onClick={() => setFavorite(!favorite)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        favorite
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      {favorite ? "♥ Favoriet" : "♡ Favoriet"}
                    </button>
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
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Optionele bereidingswijze of notities..."
                  />
                </div>

                {sourceUrl && (
                  <div className="text-xs text-gray-400 truncate">
                    Bron: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">{sourceUrl}</a>
                  </div>
                )}
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
