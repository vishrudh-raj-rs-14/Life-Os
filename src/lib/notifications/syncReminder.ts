// Syncs a habit's reminder time to Supabase so the backend cron can
// send push notifications at the right time even when the app is closed.

export async function syncReminder(params: {
  habitId: string;
  habitTitle: string;
  remindTime: string; // "HH:MM" or ""
  days: number[];     // [0..6]
}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const sub = await navigator.serviceWorker.ready
    .then(r => r.pushManager.getSubscription())
    .catch(() => null);

  if (!sub) return; // user hasn't enabled push

  const { habitId, habitTitle, remindTime, days } = params;

  if (remindTime) {
    await fetch("/api/push/remind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        habitId,
        habitTitle,
        remindTime,
        days,
      }),
    }).catch(() => {/* non-fatal */});
  } else {
    // Reminder cleared — remove from Supabase
    await fetch("/api/push/remind", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, habitId }),
    }).catch(() => {/* non-fatal */});
  }
}
