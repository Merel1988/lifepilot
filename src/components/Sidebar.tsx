"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_FOLDERS, TIME_FOLDERS } from "@/lib/folders";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userName?: string | null;
  userImage?: string | null;
  onMoveItem?: (itemId: string, newFolder: string) => void;
}

export default function Sidebar({ open, onClose, userName, userImage, onMoveItem }: SidebarProps) {
  const pathname = usePathname();
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const folderIcons: Record<string, string> = {
    PRIVE: "🏠",
    WERK: "💼",
    JANNIE_MEPPEL: "🤝",
  };

  const timeFolderIcons: Record<string, string> = {
    vandaag: "📌",
    "deze-week": "📅",
    "deze-maand": "🗓️",
    "dit-jaar": "📆",
    ooit: "💭",
    notities: "📝",
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-gray-50 border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              LifePilot
            </Link>
            <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-6">
            <div className="space-y-0.5">
              <Link
                href="/"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/zoeken"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/zoeken" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Zoeken
              </Link>
              <Link
                href="/habits"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/habits" ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Gewoontes
              </Link>
              <Link
                href="/maaltijdplanner"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/maaltijdplanner" ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Maaltijdplanner
              </Link>
            </div>

            {MAIN_FOLDERS.map((mainFolder) => (
              <div
                key={mainFolder.id}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("application/x-item-id")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTarget(mainFolder.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const itemId = e.dataTransfer.getData("application/x-item-id");
                  const currentFolder = e.dataTransfer.getData("application/x-item-folder");
                  if (itemId && currentFolder !== mainFolder.id && onMoveItem) {
                    onMoveItem(itemId, mainFolder.id);
                  }
                }}
                className={`rounded-lg transition-colors ${
                  dropTarget === mainFolder.id ? "bg-blue-50 ring-2 ring-blue-300" : ""
                }`}
              >
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pt-2">
                  {folderIcons[mainFolder.id]} {mainFolder.label}
                </h3>
                <div className="space-y-0.5">
                  {TIME_FOLDERS.map((tf) => {
                    const href = `/folder/${mainFolder.id}?sub=${tf.id}`;
                    const isActive = pathname === `/folder/${mainFolder.id}` && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sub") === tf.id;
                    return (
                      <Link
                        key={tf.id}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-xs">{timeFolderIcons[tf.id]}</span>
                        {tf.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User & sign out */}
          <div className="mt-8 pt-4 border-t border-gray-200">
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
        </div>
      </aside>
    </>
  );
}
