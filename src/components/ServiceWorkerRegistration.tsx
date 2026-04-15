"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegistration() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setRegistration(reg);

          // Check if we should ask for notification permission
          if ("Notification" in window && Notification.permission === "default") {
            // Show prompt after a delay so it's not intrusive
            setTimeout(() => setShowPrompt(true), 3000);
          } else if (Notification.permission === "granted" && reg.pushManager) {
            // Already have permission — ensure subscription exists
            subscribeToPush(reg);
          }
        })
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  async function subscribeToPush(reg: ServiceWorkerRegistration) {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    try {
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
      }

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }

  async function handleEnableNotifications() {
    setShowPrompt(false);
    const permission = await Notification.requestPermission();
    if (permission === "granted" && registration) {
      await subscribeToPush(registration);
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Meldingen inschakelen?</p>
          <p className="text-xs text-gray-500 mt-0.5">Ontvang herinneringen op het juiste moment</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowPrompt(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleEnableNotifications}
              className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
            >
              Inschakelen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
