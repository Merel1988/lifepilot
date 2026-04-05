"use client";

import { useEffect, useRef } from "react";

/**
 * Client-side reminder checker.
 * Polls /api/items every 60s for reminders due in the next 2 minutes,
 * and shows browser notifications. No server-side cron needed.
 */
export default function ReminderChecker() {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    async function checkReminders() {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);

        const currentHH = String(now.getHours()).padStart(2, "0");
        const currentMM = String(now.getMinutes()).padStart(2, "0");
        const currentTime = `${currentHH}:${currentMM}`;

        const twoMinLater = new Date(now.getTime() + 2 * 60 * 1000);
        const laterHH = String(twoMinLater.getHours()).padStart(2, "0");
        const laterMM = String(twoMinLater.getMinutes()).padStart(2, "0");
        const laterTime = `${laterHH}:${laterMM}`;

        const res = await fetch(
          `/api/items?type=REMINDER&completed=false&dateFrom=${todayStart.toISOString()}&dateTo=${todayEnd.toISOString()}`
        );
        if (!res.ok) return;

        const items: { id: string; title: string; description: string | null; time: string | null }[] = await res.json();

        for (const item of items) {
          if (!item.time) continue;
          if (item.time < currentTime || item.time > laterTime) continue;
          if (notifiedRef.current.has(item.id)) continue;

          notifiedRef.current.add(item.id);

          // Use service worker notification if available (works when tab is in background)
          const reg = await navigator.serviceWorker?.ready;
          if (reg) {
            reg.showNotification(item.title, {
              body: item.description || `Herinnering om ${item.time}`,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: `reminder-${item.id}`,
              data: { url: "/" },
            });
          } else {
            new Notification(item.title, {
              body: item.description || `Herinnering om ${item.time}`,
              icon: "/icon-192.png",
              tag: `reminder-${item.id}`,
            });
          }
        }
      } catch {
        // Silently fail — will retry next interval
      }
    }

    // Check immediately, then every 60 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
