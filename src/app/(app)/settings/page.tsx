"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle2,
  Cloud,
  Download,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { ensurePermission } from "@/lib/notifications/scheduler";
import { getRepo } from "@/lib/repo";
import { STREAK_THRESHOLD } from "@/lib/engine";
import type { Tone } from "@/types";
import { seedVishrudh, shouldSeedVishrudhProfile } from "@/lib/seed";

// ─── Platform detection helpers ──────────────────────────────────────────────

function getNotifPlatform(): "ok" | "ios-safari-standalone" | "ios-browser" | "unsupported" {
  if (typeof window === "undefined") return "ok";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return "ok";
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  // iOS 16.4+ Safari supports push only in standalone (home screen) mode
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isStandalone && isSafari) return "ios-safari-standalone"; // ✅ supported
  return "ios-browser"; // Chrome / Firefox / in-browser Safari → unsupported
}

function NotificationSetup({
  perm,
  subscribed,
  onAsk,
  onDisable,
}: {
  perm: NotificationPermission;
  subscribed: boolean;
  onAsk: () => void;
  onDisable: () => void;
}) {
  const platform = getNotifPlatform();

  // iOS Chrome / Firefox / browser tab → explain what to do
  if (platform === "ios-browser") {
    return (
      <div className="space-y-3">
        <div className="os-block p-3 space-y-2 text-[12px] text-[var(--ink-2)]">
          <div className="flex items-center gap-2 text-[var(--warn)] font-mono text-[11px]">
            <Bell size={12} /> Notifications require Safari + Home Screen on iOS
          </div>
          <p className="text-[11px] text-[var(--ink-3)] leading-relaxed">
            Chrome, Firefox, and other browsers on iPhone cannot show web notifications — Apple requires Safari.
          </p>
          <div className="space-y-1.5 mt-2">
            <div className="font-mono text-[10px] text-[var(--accent)] uppercase tracking-widest">Steps to enable</div>
            {[
              "Open this site in Safari (not Chrome)",
              "Tap the Share button ↗ at the bottom",
              `Tap "Add to Home Screen"`,
              "Open the app from your home screen",
              "Go to Settings → Enable notifications",
            ].map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className="font-mono text-[var(--accent)] shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari standalone — supported, show normal flow
  // All other platforms (Android, desktop) — show normal flow
  return (
    <div className="space-y-2">
      <div className="os-label mb-1">
        status ·{" "}
        <span className={
          perm === "granted" ? "text-[var(--success)]"
          : perm === "denied" ? "text-[var(--danger)]"
          : "text-[var(--warn)]"
        }>
          {perm}
        </span>
        {platform === "ios-safari-standalone" && (
          <span className="ml-2 text-[var(--success)]">· iOS PWA ✓</span>
        )}
      </div>

      {perm === "denied" ? (
        <div className="os-block p-3 text-[12px] text-[var(--ink-2)] space-y-1">
          <p>Notifications are <span className="text-[var(--danger)]">blocked</span> in your browser settings.</p>
          <p className="text-[var(--ink-3)]">Go to your browser Site Settings and allow notifications for this site, then come back.</p>
        </div>
      ) : subscribed ? (
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" className="text-[var(--success)]">
            <CheckCircle2 size={14} /> Notifications on
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                await reg.showNotification("Life OS — notifications working ✓", {
                  body: "You'll get daily nudges to keep your streak alive.",
                  icon: "/icon.svg",
                  tag: "test",
                });
              }
            }}
          >
            <Bell size={13} /> Test
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisable} className="text-[var(--danger)]">
            Disable
          </Button>
        </div>
      ) : (
        <Button onClick={onAsk} variant="secondary" size="sm">
          <Bell size={14} />
          Enable notifications
        </Button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser, load } = useUser();
  const [perm, setPerm]           = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [cloudUser, setCloudUser] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void load();
    if (typeof window !== "undefined" && "Notification" in window) {
      void Promise.resolve().then(() => setPerm(Notification.permission));
    }
    // Check if already subscribed in the browser's push manager
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
      );
    }
    // check Google session via new Supabase browser client
    void import("@/lib/supabase/client").then(({ supabaseBrowser }) => {
      const sb = supabaseBrowser();
      if (sb) {
        sb.auth.getUser().then(({ data }: { data: { user: { email?: string; user_metadata?: Record<string, string> } | null } }) => {
          const u = data.user;
          setCloudUser(u?.email ?? u?.user_metadata?.email ?? null);
        });
      }
    });
  }, [load]);

  if (!user) return null;

  async function ask() {
    const p = await ensurePermission();
    setPerm(p);
    if (p !== "granted" || !("serviceWorker" in navigator)) return;
    try {
      const vapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
      if (!vapidKey) return;
      const reg = await navigator.serviceWorker.ready;
      // Get or create — then always upsert to Supabase.
      // The browser may already hold a subscription from before our Supabase
      // table existed; we need to send it again.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(
            [...atob(vapidKey.replace(/-/g, "+").replace(/_/g, "/"))]
              .map(c => c.charCodeAt(0))
          ),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (res.ok) setSubscribed(true);
    } catch { /* push not available on this browser/OS */ }
  }

  async function disable() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch { /* noop */ }
  }

  async function setTone(t: Tone) {
    await setUser({ ...user!, tone: t, updatedAt: Date.now() });
  }

  async function resetAllData() {
    if (!confirm("Delete EVERYTHING and restart from scratch? This cannot be undone.")) return;
    setResetting(true);
    try {
      const repo = await getRepo();
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const sb = supabaseBrowser();
      const { data } = sb ? await sb.auth.getUser() : { data: { user: null } };
      const email = data.user?.email ?? cloudUser;
      const shouldSeedVishrudh = shouldSeedVishrudhProfile(email, user?.handle);
      const authUserId = data.user?.id ?? user!.userId;
      const t = Date.now();
      const resetUser = {
        ...user!,
        userId: authUserId,
        totalXp: 0,
        level: 1,
        streakDays: 0,
        streakFreezes: 2,
        lastActiveDate: undefined,
        dailyBonusDate: undefined,
        dailyBonusXp: undefined,
        updatedAt: t,
      };

      await repo.clearAll();
      if (sb) {
        const { error } = await sb.from("user_profile").upsert({
          id: authUserId,
          auth_user_id: authUserId,
          handle: resetUser.handle,
          display_name: resetUser.displayName,
          class_name: resetUser.className,
          tone: resetUser.tone,
          total_xp: 0,
          streak_days: 0,
          streak_freezes: 2,
          last_active_date: null,
          is_public: resetUser.isPublic,
          daily_bonus_date: null,
          daily_bonus_xp: null,
          created_at: resetUser.createdAt ?? t,
          updated_at: t,
          deleted_at: null,
        });
        if (error) throw error;
      }
      await setUser(resetUser);

      if (shouldSeedVishrudh) await seedVishrudh(authUserId);
      await load();
      window.location.href = "/";
    } finally {
      setResetting(false);
    }
  }

  async function exportData() {
    const repo = await getRepo();
    const all = await repo.exportAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/profile" className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="os-label">Configure</div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">Settings</h1>
        </div>
      </div>

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <Section icon={<Bell size={14} />} title="Notifications">
        <NotificationSetup perm={perm} subscribed={subscribed} onAsk={ask} onDisable={disable} />

        <div className="mt-4">
          <Label>Notification tone</Label>
          <Select value={user.tone} onChange={(e) => setTone(e.target.value as Tone)}>
            <option value="coach">Coach — encouraging</option>
            <option value="drill-sergeant">Drill sergeant — sharp</option>
            <option value="wise">Wise — stoic</option>
          </Select>
          <p className="text-[11px] text-[var(--ink-3)] mt-2 font-mono">
            drill sergeant gets blunt when you slip. pick what moves you.
          </p>
        </div>

        <div className="mt-4 os-block p-3 space-y-1.5 text-[12px] text-[var(--ink-2)]">
          <div className="os-label mb-1">schedule</div>
          {[
            ["09:00", "Morning nudge if no habits started"],
            ["13:00", "Midday check-in if <30% done"],
            ["20:00", `Streak alert if streak is at risk`],
            ["21:30", "End-of-day recap"],
            ["08:05", "Yesterday miss reminder"],
          ].map(([t, d]) => (
            <div key={t} className="flex items-start gap-2">
              <span className="font-mono text-[var(--accent)] shrink-0 w-11">{t}</span>
              <span>{d}</span>
            </div>
          ))}
          <p className="text-[11px] text-[var(--ink-3)] font-mono mt-2">
            streak = ≥{Math.round(STREAK_THRESHOLD * 100)}% of due habits completed that day
          </p>
        </div>
      </Section>

      {/* ── Account ───────────────────────────────────────────────────── */}
      <Section icon={<Cloud size={14} />} title="Account">
        {cloudUser ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[var(--success)]">
              <CheckCircle2 size={14} />
              <span>Google account: <span className="font-mono">{cloudUser}</span></span>
            </div>
            <p className="text-xs text-[var(--ink-3)] font-mono">
              data syncs automatically when online.
            </p>
            <Button variant="secondary" size="sm" onClick={async () => {
              const { supabaseBrowser } = await import("@/lib/supabase/client");
              const sb = supabaseBrowser();
              if (sb) await sb.auth.signOut();
              window.location.href = "/login";
            }}>
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--ink-2)]">Not signed in with Google.</p>
            <Button size="sm" onClick={() => { window.location.href = "/login"; }}>
              <LogIn size={14} /> Sign in with Google
            </Button>
          </div>
        )}
      </Section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <Section icon={<BarChart3 size={14} />} title="Analytics">
        <Link href="/stats">
          <Button variant="secondary" size="sm">
            Open stats
          </Button>
        </Link>
      </Section>

      {/* ── Privacy ───────────────────────────────────────────────────── */}
      <Section icon={<ShieldCheck size={14} />} title="Privacy">
        <label className="flex items-center justify-between text-sm">
          <span className="text-[var(--ink-2)]">Public profile (/u/{user.handle})</span>
          <input
            type="checkbox"
            checked={!!user.isPublic}
            onChange={(e) =>
              setUser({
                ...user,
                isPublic: e.target.checked ? 1 : 0,
                updatedAt: Date.now(),
              })
            }
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
      </Section>

      {/* ── Data export ───────────────────────────────────────────────── */}
      <Section icon={<Download size={14} />} title="Data">
        <div className="flex flex-col gap-2">
          <Button onClick={exportData} variant="secondary" size="sm">
            Export JSON backup
          </Button>
          <Button
            onClick={resetAllData}
            variant="ghost"
            size="sm"
            loading={resetting}
            className="text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)]/10"
          >
            <RotateCcw size={13} /> Reset all data
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="os-block p-4">
      <div className="flex items-center gap-2 mb-3 text-[var(--accent)]">
        {icon}
        <h2 className="text-sm font-medium text-[var(--ink-1)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}
