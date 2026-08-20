"use client";

import { useCallback, useEffect, useState } from "react";
import { MAIN_FOLDERS } from "@/lib/folders";

/**
 * De iCloud-koppeling op /agenda.
 *
 * Dit bestaat omdat een gedeelde iCloud-agenda niet te publiceren is door iemand
 * die hem niet zelf heeft aangemaakt. Met een app-specifiek wachtwoord leest de
 * app de agenda's die Merel al mag zien — alleen lezen, nooit schrijven.
 */

interface Account {
  id: string;
  username: string;
  folder: string;
  color: string;
  enabled: boolean;
  selected: string[] | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface RemoteCalendar {
  url: string;
  name: string;
  color: string | null;
  shared: boolean;
}

/** Wat iCloud in de agendamap had staan, en wat de app ermee deed. */
interface Diagnose {
  href: string | null;
  naam: string | null;
  soorten: string[];
  componenten: string[];
  meegenomen: boolean;
  reden: string | null;
}

const PRESET_COLORS = ["#6d28d9", "#dc2626", "#16a34a", "#0891b2", "#ea580c", "#db2777"];

function formatMoment(iso: string | null): string {
  if (!iso) return "nog niet opgehaald";
  return new Date(iso).toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ICloudCalendars({ onChange }: { onChange?: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [calendars, setCalendars] = useState<Record<string, RemoteCalendar[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnose, setDiagnose] = useState<{ home: string | null; rijen: Diagnose[] } | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [folder, setFolder] = useState("PRIVE");
  const [color, setColor] = useState("#6d28d9");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-accounts", { cache: "no-store" });
      const data: Account[] = await res.json();
      setAccounts(data);
    } catch {
      setError("Kon de gekoppelde accounts niet ophalen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** De agenda's van een account live opvragen, zodat de lijst niet verouderd raakt. */
  const loadCalendars = useCallback(async (id: string) => {
    setRefreshing(id);
    try {
      const res = await fetch(`/api/calendar-accounts/${id}/calendars`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        if (data.diagnose) setDiagnose({ home: data.home ?? null, rijen: data.diagnose });
        return;
      }
      setCalendars((prev) => ({ ...prev, [id]: data.calendars }));
    } catch {
      setError("Kon de agenda's niet ophalen bij iCloud.");
    } finally {
      setRefreshing(null);
    }
  }, []);

  useEffect(() => {
    for (const account of accounts) {
      if (!calendars[account.id]) loadCalendars(account.id);
    }
    // Alleen bij nieuwe accounts opnieuw ophalen, niet bij elke render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDiagnose(null);
    try {
      const res = await fetch("/api/calendar-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, folder, color }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        if (data.diagnose) setDiagnose({ home: data.home ?? null, rijen: data.diagnose });
        return;
      }
      setAccounts((prev) => [...prev, data.account]);
      setCalendars((prev) => ({ ...prev, [data.account.id]: data.calendars }));
      setUsername("");
      setPassword("");
      setShowForm(false);
      onChange?.();
    } catch {
      setError("Koppelen mislukte. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/calendar-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    onChange?.();
  }

  async function remove(id: string) {
    await fetch(`/api/calendar-accounts/${id}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    onChange?.();
  }

  /** Een agenda aan- of uitzetten binnen een account. */
  function toggleCalendar(account: Account, url: string) {
    const beschikbaar = (calendars[account.id] ?? []).map((c) => c.url);
    const huidig = account.selected ?? beschikbaar;
    const nieuw = huidig.includes(url) ? huidig.filter((u) => u !== url) : [...huidig, url];
    patch(account.id, { selected: nieuw });
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">iCloud-agenda</h3>
        {accounts.length === 0 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            + Koppelen
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Leest ook agenda&apos;s die iemand anders met je heeft gedeeld. Alleen lezen — de app
        verandert nooit iets in je agenda.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        accounts.map((account) => {
          const gevonden = calendars[account.id];
          const actief = account.selected;
          return (
            <div key={account.id} className="border-t border-gray-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{account.username}</p>
                  <p className="text-xs text-gray-400">
                    {account.lastError ? (
                      <span className="text-red-600">{account.lastError}</span>
                    ) : (
                      `Laatst opgehaald: ${formatMoment(account.lastSyncAt)}`
                    )}
                  </p>
                </div>
                <select
                  value={account.folder}
                  onChange={(e) => patch(account.id, { folder: e.target.value })}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50"
                >
                  {MAIN_FOLDERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => patch(account.id, { enabled: !account.enabled })}
                  className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                    account.enabled ? "bg-violet-600" : "bg-gray-200"
                  }`}
                  aria-label="Account aan of uit"
                  role="switch"
                  aria-checked={account.enabled}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      account.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <button
                  onClick={() => remove(account.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label="Koppeling verwijderen"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Welke agenda's van dit account meedoen */}
              <div className="mt-3 ml-6">
                {refreshing === account.id && !gevonden ? (
                  <p className="text-xs text-gray-400">Agenda&apos;s ophalen...</p>
                ) : gevonden && gevonden.length > 0 ? (
                  <div className="space-y-1.5">
                    {gevonden.map((agenda) => {
                      const aan = actief === null || actief.includes(agenda.url);
                      return (
                        <label
                          key={agenda.url}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={aan}
                            onChange={() => toggleCalendar(account, agenda.url)}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          {agenda.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: agenda.color }}
                            />
                          )}
                          <span className={aan ? "" : "text-gray-400"}>{agenda.name}</span>
                          {agenda.shared && (
                            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                              gedeeld
                            </span>
                          )}
                        </label>
                      );
                    })}
                    <button
                      onClick={() => loadCalendars(account.id)}
                      disabled={refreshing === account.id}
                      className="text-xs text-violet-600 hover:text-violet-700 disabled:text-gray-300 mt-1"
                    >
                      {refreshing === account.id ? "Vernieuwen..." : "Lijst vernieuwen"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Geen agenda&apos;s gevonden.</p>
                )}
              </div>
            </div>
          );
        })
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <p>{error}</p>

          {/* Wat iCloud teruggaf. Zonder dit is "niets gevonden" niet te repareren. */}
          {diagnose && (
            <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-800">
              {diagnose.home && (
                <p className="mb-2 break-all">
                  <span className="font-medium">Gekeken in:</span> {diagnose.home}
                </p>
              )}
              {diagnose.rijen.length === 0 ? (
                <p>iCloud gaf geen enkele map terug op dat adres.</p>
              ) : (
                <>
                  <p className="font-medium mb-1">
                    Gevonden ({diagnose.rijen.length}):
                  </p>
                  <ul className="space-y-1">
                    {diagnose.rijen.map((rij, i) => (
                      <li key={i} className="break-all">
                        <span className="font-medium">{rij.naam || rij.href || "zonder naam"}</span>
                        {rij.soorten.length > 0 && <> — soort: {rij.soorten.join(", ")}</>}
                        {rij.componenten.length > 0 && <> — inhoud: {rij.componenten.join(", ")}</>}
                        {rij.reden && <> — overgeslagen: {rij.reden}</>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-2 text-red-600">
                Stuur dit lijstje door als het niet duidelijk is; hiermee is te zien welke agenda
                iCloud wel heeft en waarom hij niet meedoet.
              </p>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={connect} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="Je Apple ID (e-mailadres)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
          />
          <input
            type="password"
            autoComplete="off"
            placeholder="App-specifiek wachtwoord (xxxx-xxxx-xxxx-xxxx)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Categorie</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {MAIN_FOLDERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Kleur</label>
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Kleur ${c}`}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1.5">
            <p className="font-medium text-gray-700">Hoe maak ik een app-specifiek wachtwoord?</p>
            <p>
              Ga naar <span className="font-medium">account.apple.com</span> → Aanmelden en
              beveiliging → App-specifieke wachtwoorden → maak er een aan met de naam
              &quot;LifePilot&quot;. Je krijgt een code van vier keer vier tekens; die vul je
              hierboven in.
            </p>
            <p>
              Je gewone Apple-wachtwoord werkt hier niet. Je kunt dit wachtwoord bij Apple altijd
              weer intrekken; dan stopt de koppeling meteen.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !username.trim() || !password.trim()}
              className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Verbinding testen..." : "Koppelen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
