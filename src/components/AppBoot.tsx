"use client";

import { useEffect } from "react";
import { useUser } from "@/store/useUser";
import { startScheduler } from "@/lib/notifications/scheduler";
import { startSyncLoop } from "@/lib/social/sync";

export function AppBoot() {
  const user = useUser((s) => s.user);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {/* noop */});
    }
    startSyncLoop();
  }, []);

  useEffect(() => {
    if (!user) return;
    startScheduler(user.tone);
  }, [user]);

  return null;
}
