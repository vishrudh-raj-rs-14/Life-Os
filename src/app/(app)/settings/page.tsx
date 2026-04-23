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
  ShieldCheck,
} from "lucide-react";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { ensurePermission } from "@/lib/notifications/scheduler";
import { getRepo } from "@/lib/repo";
import { hasSupabase, supabase } from "@/lib/social/supabase";
import { STREAK_THRESHOLD } from "@/lib/engine";
import type { Tone } from "@/types";

export default function SettingsPage() {
  const { user, setUser, load } = useUser();
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [authEmail, setAuthEmail] = useState("");
  const [authStep, setAuthStep] = useState<"idle" | "sent" | "checking">("idle");
  const [cloudUser, setCloudUser] = useState<string | null>(null);

  useEffect(() => {
    void load();
    if (typeof window !== "undefined" && "Notification" in window) {
      void Promise.resolve().then(() => setPerm(Notification.permission));
    }
    // check if already signed in to Supabase
    if (hasSupabase()) {
      void supabase()!
        .auth.getUser()
        .then(({ data }) => setCloudUser(data.user?.email ?? null));
    }
  }, [load]);

  if (!user) return null;

  async function ask() {
    const p = await ensurePermission();
    setPerm(p);
  }

  async function setTone(t: Tone) {
    await setUser({ ...user!, tone: t, updatedAt: Date.now() });
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

  async function sendMagicLink() {
    const sb = supabase();
    if (!sb || !authEmail.trim()) return;
    setAuthStep("checking");
    const { error } = await sb.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      alert(error.message);
      setAuthStep("idle");
    } else {
      setAuthStep("sent");
    }
  }

  async function signOut() {
    const sb = supabase();
    if (!sb) return;
    await sb.auth.signOut();
    setCloudUser(null);
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
        <div className="os-label mb-2">
          status ·{" "}
          <span
            className={
              perm === "granted"
                ? "text-[var(--success)]"
                : perm === "denied"
                  ? "text-[var(--danger)]"
                  : "text-[var(--warn)]"
            }
          >
            {perm}
          </span>
        </div>
        <Button onClick={ask} variant="secondary" size="sm">
          {perm === "granted" ? <CheckCircle2 size={14} /> : <Bell size={14} />}
          {perm === "granted" ? "Notifications on" : "Enable notifications"}
        </Button>

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

      {/* ── Cloud sync ────────────────────────────────────────────────── */}
      <Section icon={<Cloud size={14} />} title="Cloud sync">
        {!hasSupabase() ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              Cloud sync is <span className="text-[var(--warn)]">not configured</span>.
              Add your Supabase keys to enable cross-device sync, accounts, and social.
            </p>
            <div className="os-block p-3 space-y-2 text-[12px] font-mono">
              <div className="os-label mb-1">setup steps</div>
              <div className="text-[var(--ink-2)] space-y-1.5">
                <div>01 · go to <span className="text-[var(--accent)]">supabase.com</span> → New project</div>
                <div>02 · Settings → API → copy URL + anon key</div>
                <div>03 · create <span className="text-[var(--accent)]">.env.local</span> in project root:</div>
              </div>
              <pre className="text-[11px] text-[var(--ink-3)] mt-1 overflow-x-auto">{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}</pre>
              <div className="text-[var(--ink-2)] space-y-1.5">
                <div>04 · run the SQL in <span className="text-[var(--accent)]">supabase/migrations/001_init.sql</span> via Supabase SQL editor</div>
                <div>05 · restart dev server: <span className="text-[var(--accent)]">npm run dev</span></div>
              </div>
            </div>
          </div>
        ) : cloudUser ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-[var(--success)]">
              <CheckCircle2 size={14} />
              <span>Signed in as <span className="font-mono">{cloudUser}</span></span>
            </div>
            <p className="text-xs text-[var(--ink-3)] font-mono">
              data syncs automatically when online.
            </p>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-2)]">
              Sign in with a magic link — no password needed.
            </p>
            {authStep === "sent" ? (
              <div className="os-block p-3 text-sm text-[var(--success)]">
                ✓ Check your email for the magic link.
              </div>
            ) : (
              <>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={sendMagicLink}
                  disabled={authStep === "checking" || !authEmail.trim()}
                >
                  <LogIn size={14} />
                  {authStep === "checking" ? "Sending…" : "Send magic link"}
                </Button>
              </>
            )}
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
        <Button onClick={exportData} variant="secondary" size="sm">
          Export JSON backup
        </Button>
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
