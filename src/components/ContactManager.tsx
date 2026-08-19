"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_KEEP_IN_TOUCH_WEEKS,
  nextBirthday,
  type BirthdayEntry,
} from "@/lib/contacts";
import { localDay } from "@/lib/day";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  keepInTouchWeeks: number | null;
  lastContactAt: string | null;
}

const MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  keepInTouchWeeks: "",
};

type Form = typeof emptyForm;

function toForm(contact: Contact): Form {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    notes: contact.notes ?? "",
    birthDay: contact.birthDay?.toString() ?? "",
    birthMonth: contact.birthMonth?.toString() ?? "",
    birthYear: contact.birthYear?.toString() ?? "",
    keepInTouchWeeks: contact.keepInTouchWeeks?.toString() ?? "",
  };
}

function birthdayText(contact: Contact): string | null {
  if (!contact.birthDay || !contact.birthMonth) return null;
  const base = `${contact.birthDay} ${MONTHS[contact.birthMonth - 1]}`;
  if (!contact.birthYear) return base;

  const next = nextBirthday(contact.birthMonth, contact.birthDay, localDay());
  const turning = new Date(`${next.day}T00:00:00.000Z`).getUTCFullYear() - contact.birthYear;
  return `${base} · wordt ${turning}`;
}

function weeksSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (7 * 86_400_000));
}

export default function ContactManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Contacten konden niet worden geladen.");
        return;
      }
      setContacts(data);
      setError(null);
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
    setNotice(null);
  }

  function startEdit(contact: Contact) {
    setForm(toForm(contact));
    setEditing(contact.id);
    setNotice(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Vul een naam in.");
      return;
    }
    if (form.birthDay && !form.birthMonth) {
      setError("Kies ook een maand bij de verjaardag.");
      return;
    }

    setSaving(true);
    setError(null);

    const isNew = editing === "new";

    try {
      const res = await fetch(isNew ? "/api/contacts" : `/api/contacts/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Opslaan mislukte.");
        return;
      }
      setNotice(isNew ? `${data.name} toegevoegd.` : `${data.name} bijgewerkt.`);
      setEditing(null);
      await load();
    } catch {
      setError("Opslaan mislukte. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(contact: Contact) {
    if (!confirm(`${contact.name} verwijderen?`)) return;

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setNotice(`${contact.name} verwijderd.`);
      setEditing(null);
      await load();
    } catch {
      setError(`${contact.name} kon niet worden verwijderd.`);
    }
  }

  async function markContacted(contact: Contact) {
    try {
      const res = await fetch(`/api/contacts/${contact.id}/touch`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setNotice(`Contact met ${contact.name} vastgelegd.`);
      await load();
    } catch {
      setError("Kon dit niet opslaan.");
    }
  }

  // Wie het eerst jarig is, staat bovenaan; daarna alfabetisch
  const today = localDay();
  const withBirthday: (Contact & { next: BirthdayEntry["inDays"] })[] = [];
  const withoutBirthday: Contact[] = [];

  for (const contact of contacts) {
    if (contact.birthDay && contact.birthMonth) {
      withBirthday.push({
        ...contact,
        next: nextBirthday(contact.birthMonth, contact.birthDay, today).inDays,
      });
    } else {
      withoutBirthday.push(contact);
    }
  }
  withBirthday.sort((a, b) => a.next - b.next);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Contacten</h1>
          <p className="text-gray-500">
            Verjaardagen komen op je ochtendkaart, een week vooruit.
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
        >
          Toevoegen
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {notice && (
        <p role="status" className="text-sm text-violet-700">
          {notice}
        </p>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
        >
          <h2 className="font-semibold text-gray-900">
            {editing === "new" ? "Nieuw contact" : "Contact bijwerken"}
          </h2>

          <Field label="Naam">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Voor- en achternaam"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefoon">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Adres">
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Straat, postcode, plaats"
              className={inputClass}
            />
          </Field>

          <Field label="Verjaardag" hint="Het jaar mag leeg blijven — dan tonen we geen leeftijd">
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={31}
                value={form.birthDay}
                onChange={(e) => setForm({ ...form, birthDay: e.target.value })}
                placeholder="Dag"
                className={`${inputClass} w-20`}
              />
              <select
                value={form.birthMonth}
                onChange={(e) => setForm({ ...form, birthMonth: e.target.value })}
                className={`${inputClass} flex-1`}
              >
                <option value="">Maand</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1900}
                max={2100}
                value={form.birthYear}
                onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
                placeholder="Jaar"
                className={`${inputClass} w-24`}
              />
            </div>
          </Field>

          <Field
            label="Af en toe contact"
            hint="Na dit aantal weken zonder contact komt deze persoon op je ochtendkaart. Leeg = geen herinnering."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={260}
                value={form.keepInTouchWeeks}
                onChange={(e) => setForm({ ...form, keepInTouchWeeks: e.target.value })}
                placeholder={String(DEFAULT_KEEP_IN_TOUCH_WEEKS)}
                className={`${inputClass} w-24`}
              />
              <span className="text-sm text-gray-500">weken</span>
            </div>
          </Field>

          <Field label="Notities" hint="Waar wilde je naar vragen?">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Nieuwe baan, verhuizing, ziek geweest…"
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Annuleren
            </button>
            {editing !== "new" && (
              <button
                type="button"
                onClick={() => {
                  const contact = contacts.find((c) => c.id === editing);
                  if (contact) void remove(contact);
                }}
                className="ml-auto text-sm text-red-600 hover:text-red-700"
              >
                Verwijderen
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-gray-400">Laden…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
          <p className="text-gray-600">Nog geen contacten.</p>
          <p className="mt-1 text-sm text-gray-500">
            Voeg iemand toe met een verjaardag, en je krijgt er een week vooruit
            bericht van op je ochtendkaart.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {withBirthday.length > 0 && (
            <ContactList
              label="Op verjaardag"
              contacts={withBirthday}
              onEdit={startEdit}
              onContacted={markContacted}
            />
          )}
          {withoutBirthday.length > 0 && (
            <ContactList
              label="Zonder verjaardag"
              contacts={withoutBirthday}
              onEdit={startEdit}
              onContacted={markContacted}
            />
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-gray-500">{label}</span>
      <span className="block [&>input]:w-full [&>select]:w-full [&>textarea]:w-full">
        {children}
      </span>
      {hint && <span className="block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

function ContactList({
  label,
  contacts,
  onEdit,
  onContacted,
}: {
  label: string;
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onContacted: (contact: Contact) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-gray-400">
        {label}
      </h2>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {contacts.map((contact) => {
          const weeks = weeksSince(contact.lastContactAt);
          const birthday = birthdayText(contact);

          return (
            <li key={contact.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => onEdit(contact)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium text-gray-900">
                    {contact.name}
                  </span>
                  {birthday && (
                    <span className="block text-sm text-gray-500">🎂 {birthday}</span>
                  )}
                  {contact.phone && (
                    <span className="block text-sm text-gray-500">{contact.phone}</span>
                  )}
                  {contact.notes && (
                    <span className="mt-1 block text-sm text-gray-400">
                      {contact.notes}
                    </span>
                  )}
                </button>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {contact.keepInTouchWeeks && (
                    <span className="text-xs text-gray-400">
                      {weeks === null
                        ? "nog geen contact"
                        : weeks === 0
                          ? "deze week"
                          : weeks === 1
                            ? "1 week terug"
                            : `${weeks} weken terug`}
                    </span>
                  )}
                  <button
                    onClick={() => onContacted(contact)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-700"
                  >
                    Gesproken
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
