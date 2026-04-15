"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userName?: string | null;
  userImage?: string | null;
}

const TIME_SUBITEMS = [
  { id: "vandaag", label: "Vandaag" },
  { id: "deze-week", label: "Deze week" },
  { id: "deze-maand", label: "Deze maand" },
  { id: "dit-jaar", label: "Dit jaar" },
  { id: "ooit", label: "Ooit" },
];

export default function Sidebar({ open, onClose, userName, userImage }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTime = searchParams.get("tijd");

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-gray-50 border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between flex-shrink-0">
          <Link href="/" className="text-xl font-bold text-gray-900">
            LifePilot
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Main navigation */}
          <div className="space-y-0.5">
            <NavLink href="/" pathname={pathname} onClick={onClose} icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            }>Dashboard</NavLink>
            <NavLink href="/zoeken" pathname={pathname} onClick={onClose} icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }>Zoeken</NavLink>
            <NavLink href="/habits" pathname={pathname} onClick={onClose} icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }>Gewoontes</NavLink>
            <NavLink href="/maaltijdplanner" pathname={pathname} onClick={onClose} color="green" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }>Maaltijdplanner</NavLink>
            <NavLink href="/recepten" pathname={pathname} onClick={onClose} color="green" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }>Recepten</NavLink>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200" />

          {/* Item type navigation with time subitems */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</h3>
            <div className="space-y-0.5">
              {/* Taken */}
              <NavLink href="/taken" pathname={pathname} onClick={onClose} icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }>Taken</NavLink>
              {pathname === "/taken" && (
                <SubItems basePath="/taken" currentTime={currentTime} onClick={onClose} />
              )}

              {/* Herinneringen */}
              <NavLink href="/herinneringen" pathname={pathname} onClick={onClose} icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }>Herinneringen</NavLink>
              {pathname === "/herinneringen" && (
                <SubItems basePath="/herinneringen" currentTime={currentTime} onClick={onClose} />
              )}

              {/* Notities (no time subitems — notes don't have dates) */}
              <NavLink href="/notities" pathname={pathname} onClick={onClose} icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }>Notities</NavLink>

              {/* Agenda */}
              <NavLink href="/agenda" pathname={pathname} onClick={onClose} icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }>Agenda</NavLink>
            </div>
          </div>
        </nav>

        {/* User & sign out — fixed at bottom */}
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 px-3">
            {userImage ? (
              <img src={userImage} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                {userName?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userName || "Gebruiker"}</p>
            </div>
            <a
              href="/api/auth/signout"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Uitloggen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  href,
  pathname,
  onClick,
  icon,
  color = "blue",
  children,
}: {
  href: string;
  pathname: string;
  onClick: () => void;
  icon: React.ReactNode;
  color?: "blue" | "green";
  children: React.ReactNode;
}) {
  const isActive = pathname === href;
  const activeClass = color === "green" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive ? activeClass : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function SubItems({
  basePath,
  currentTime,
  onClick,
}: {
  basePath: string;
  currentTime: string | null;
  onClick: () => void;
}) {
  return (
    <div className="ml-9 space-y-0.5 mt-0.5 mb-1">
      <Link
        href={basePath}
        onClick={onClick}
        className={`block px-3 py-1 rounded-md text-xs transition-colors ${
          !currentTime
            ? "bg-blue-100 text-blue-700 font-medium"
            : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        Alles
      </Link>
      {TIME_SUBITEMS.map((sub) => (
        <Link
          key={sub.id}
          href={`${basePath}?tijd=${sub.id}`}
          onClick={onClick}
          className={`block px-3 py-1 rounded-md text-xs transition-colors ${
            currentTime === sub.id
              ? "bg-blue-100 text-blue-700 font-medium"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          {sub.label}
        </Link>
      ))}
    </div>
  );
}
