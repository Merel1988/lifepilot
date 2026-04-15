"use client";

import { MAIN_FOLDERS } from "@/lib/folders";
import { type Item, formatRecurrenceDays, isCompletedForDate, getTodayDateString } from "@/lib/types";

interface ItemCardProps {
  item: Item;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (item: Item) => void;
}

export default function ItemCard({ item, onToggle, onDelete, onEdit }: ItemCardProps) {
  const folderLabel = MAIN_FOLDERS.find((f) => f.id === item.folder)?.label ?? item.folder;
  const typeLabels: Record<string, string> = { TASK: "Taak", REMINDER: "Herinnering", NOTE: "Notitie" };
  const typeColors: Record<string, string> = {
    TASK: "bg-violet-100 text-violet-700",
    REMINDER: "bg-amber-100 text-amber-700",
    NOTE: "bg-green-100 text-green-700",
  };

  const isRecurring = item.recurring && item.recurrenceDays;
  const todayStr = getTodayDateString();
  const completedToday = isRecurring ? isCompletedForDate(item, todayStr) : item.completed;

  const formattedDate = item.date
    ? new Date(item.date).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-item-id", item.id);
        e.dataTransfer.setData("application/x-item-folder", item.folder);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm transition-all hover:border-gray-200 cursor-pointer ${completedToday ? "opacity-50" : ""}`}
      onClick={() => onEdit(item)}
    >
      {item.type === "TASK" && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(item.id, !completedToday); }}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            completedToday ? "bg-violet-600 border-violet-600" : "border-gray-300 hover:border-violet-400"
          }`}
        >
          {completedToday && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      {item.type === "REMINDER" && (
        <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center text-amber-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      )}

      {item.type === "NOTE" && (
        <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center text-green-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-900 ${completedToday ? "line-through" : ""}`}>
          {item.title}
        </p>
        {item.description && (
          <div
            className="text-xs text-gray-500 mt-0.5 line-clamp-2 [&_ul[data-type='taskList']]:flex [&_ul[data-type='taskList']]:gap-1 [&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:p-0"
            dangerouslySetInnerHTML={{
              __html: item.description.replace(/<img[^>]*>/g, "").replace(/<h[23][^>]*>/g, "<strong>").replace(/<\/h[23]>/g, "</strong> "),
            }}
          />
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Attachment indicator */}
          {item.attachments && item.attachments.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {item.attachments.length}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[item.type] || "bg-gray-100 text-gray-600"}`}>
            {typeLabels[item.type] || item.type}
          </span>
          <span className="text-xs text-gray-400">{folderLabel}</span>
          {isRecurring && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
              ↻ {formatRecurrenceDays(item.recurrenceDays!)}
            </span>
          )}
          {formattedDate && !isRecurring && <span className="text-xs text-gray-400">{formattedDate}</span>}
          {item.time && <span className="text-xs text-amber-600 font-medium">{item.time}</span>}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
