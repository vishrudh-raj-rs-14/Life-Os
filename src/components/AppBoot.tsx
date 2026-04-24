"use client";

import { useEffect } from "react";
import { useUser } from "@/store/useUser";
import { startScheduler } from "@/lib/notifications/scheduler";
import { startSyncLoop } from "@/lib/social/sync";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Convert a base64 URL string to a Uint8Array (required by pushManager.subscribe)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!VAPID_PUBLIC) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as unknown as ArrayBuffer,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  } catch {
    // noop — push not available or blocked
  }
}

export function AppBoot() {
  const user = useUser((s) => s.user);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // Attempt push subscription after SW is ready
          void subscribeToPush();
        })
        .catch(() => {/* noop */});
    }
    startSyncLoop();
  }, []);

  useEffect(() => {
    if (!user) return;
    startScheduler(user.tone);
    // Re-attempt subscription in case permission was just granted
    void subscribeToPush();
  }, [user]);

  return null;
}
