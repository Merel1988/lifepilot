"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Vier ingangen in plaats van tien: Vandaag, Lijst, Eten, Zoeken.
 *
 * Op mobiel een tabbalk onderaan (waar je duim is), op desktop een smalle rail
 * links. De oude pagina's bestaan nog — contacten, agenda, gewoontes, recepten
 * en de losse typelijsten — maar staan onder "Meer" in plaats van in het menu.
 * Zonder die la zouden ze alleen nog via de URL te vinden zijn.
 */

interface MainNavProps {
  userName?: string | null;
  userImage?: string | null;
  /** Het uitlog-formulier; komt uit een server component (server action). */
  signOutSlot?: React.ReactNode;
}

interface Entry {
  href: string;
  label: string;
  /** Paden die deze ingang laten oplichten, ook al is het een andere pagina. */
  owns: string[];
  icon: React.ReactNode;
}

const icon = (path: string) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ENTRIES: Entry[] = [
  {
    href: "/",
    label: "Vandaag",
    owns: ["/contacten", "/agenda", "/habits"],
    icon: icon("M12 3v1m0 16v1m9-10h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"),
  },
  {
    href: "/lijst",
    label: "Lijst",
    owns: ["/taken", "/herinneringen", "/notities", "/folder"],
    icon: icon("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"),
  },
  {
    href: "/maaltijdplanner",
    label: "Eten",
    owns: ["/recepten"],
    icon: icon("M12 3v9m0 0a3 3 0 003-3V3m-6 6a3 3 0 003 3m6 0a6 6 0 01-6 6m0 0a6 6 0 01-6-6m6 6v3"),
  },
  {
    href: "/zoeken",
    label: "Zoeken",
    owns: [],
    icon: icon("M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"),
  },
];

/** Pagina's die uit het menu zijn maar wel moeten blijven bestaan. */
const MORE: { href: string; label: string; hint?: string }[] = [
  { href: "/contacten", label: "Contacten", hint: "verjaardagen en bijhouden" },
  { href: "/agenda", label: "Agenda", hint: "feeds koppelen" },
  { href: "/habits", label: "Gewoontes" },
  { href: "/recepten", label: "Recepten" },
];

const MORE_LISTS: { href: string; label: string }[] = [
  { href: "/taken", label: "Alleen taken" },
  { href: "/herinneringen", label: "Alleen herinneringen" },
  { href: "/notities", label: "Alleen notities" },
];

function isActive(entry: Entry, pathname: string): boolean {
  if (entry.href === "/") return pathname === "/" || entry.owns.some((p) => pathname.startsWith(p));
  return pathname.startsWith(entry.href) || entry.owns.some((p) => pathname.startsWith(p));
}

export default function MainNav({ userName, userImage, signOutSlot }: MainNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // Eén badge, op de ingang die het verhaal van de app is: wat moet vandaag.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/item-counts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const open = (data?.TASK?.vandaag ?? 0) + (data?.REMINDER?.vandaag ?? 0);
        setTodayCount(open);
      } catch {
        // Een ontbrekende badge is geen foutmelding waard
      }
    }

    load();
    window.addEventListener("item-moved", load);
    return () => {
      cancelled = true;
      window.removeEventListener("item-moved", load);
    };
  }, [pathname]);

  const current = ENTRIES.find((e) => isActive(e, pathname));

  // De kop op mobiel noemt de pagina waar je bent, ook als die onder "Meer" zit
  const pageLabel =
    [...MORE, ...MORE_LISTS].find((m) => pathname.startsWith(m.href))?.label ??
    (current && current.href !== "/" ? current.label : "LifePilot");

  return (
    <>
      {/* Desktop: smalle rail */}
      <aside className="hidden lg:flex w-24 flex-shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-gray-50 py-4">
        <Link href="/" className="mb-3 text-sm font-bold text-violet-700">
          LP
        </Link>

        {ENTRIES.map((entry) => (
          <RailLink
            key={entry.href}
            entry={entry}
            active={isActive(entry, pathname)}
            badge={entry.href === "/" ? todayCount : null}
            onNavigate={() => setMoreOpen(false)}
          />
        ))}

        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
              moreOpen ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {icon("M5 12h.01M12 12h.01M19 12h.01")}
            Meer
          </button>
          <Avatar userName={userName} userImage={userImage} />
        </div>
      </aside>

      {/* Mobiel: vaste kop met titel en de la */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-lg font-bold text-gray-900">{pageLabel}</span>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500"
          aria-label="Meer"
        >
          Meer
          {icon("M5 12h.01M12 12h.01M19 12h.01")}
        </button>
      </header>

      {/* Mobiel: tabbalk onderaan */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex">
          {ENTRIES.map((entry) => (
            <TabLink
              key={entry.href}
              entry={entry}
              active={isActive(entry, pathname)}
              badge={entry.href === "/" ? todayCount : null}
              onNavigate={() => setMoreOpen(false)}
            />
          ))}
        </div>
      </nav>

      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 shadow-xl lg:inset-auto lg:bottom-4 lg:left-28 lg:w-72 lg:rounded-2xl">
            <div className="space-y-0.5">
              {MORE.map((item) => (
                <SheetLink
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  onNavigate={() => setMoreOpen(false)}
                />
              ))}
            </div>

            <p className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Losse lijsten
            </p>
            <div className="space-y-0.5">
              {MORE_LISTS.map((item) => (
                <SheetLink
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  onNavigate={() => setMoreOpen(false)}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
              <Avatar userName={userName} userImage={userImage} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                {userName || "Gebruiker"}
              </span>
              {signOutSlot}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function RailLink({
  entry,
  active,
  badge,
  onNavigate,
}: {
  entry: Entry;
  active: boolean;
  badge: number | null;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      className={`relative flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
        active ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {entry.icon}
      {entry.label}
      {badge ? <Badge count={badge} /> : null}
    </Link>
  );
}

function TabLink({
  entry,
  active,
  badge,
  onNavigate,
}: {
  entry: Entry;
  active: boolean;
  badge: number | null;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
        active ? "text-violet-700" : "text-gray-400"
      }`}
    >
      {entry.icon}
      {entry.label}
      {badge ? <Badge count={badge} /> : null}
    </Link>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute right-2 top-1 min-w-[18px] rounded-full bg-violet-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SheetLink({
  href,
  label,
  hint,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  hint?: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-violet-50 font-medium text-violet-700" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span>{label}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </Link>
  );
}

function Avatar({ userName, userImage }: { userName?: string | null; userImage?: string | null }) {
  if (userImage) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar van de provider, geen next/image loader ingericht
    return <img src={userImage} alt="" className="h-8 w-8 flex-shrink-0 rounded-full" />;
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
      {userName?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}
