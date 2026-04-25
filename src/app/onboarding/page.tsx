"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { seedStarter, seedVishrudh } from "@/lib/seed";
import { useUser } from "@/store/useUser";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tone } from "@/types";

const TONES: { value: Tone; label: string; hint: string; sample: string }[] = [
  {
    value: "coach",
    label: "Coach",
    hint: "Encouraging and consistent.",
    sample: "08:30 — Read engineering blog. You've got this.",
  },
  {
    value: "drill-sergeant",
    label: "Drill sergeant",
    hint: "No excuses. Blunt when you slip.",
    sample: "08:30. Read engineering blog. NOW.",
  },
  {
    value: "wise",
    label: "Wise",
    hint: "Stoic. Observes without judgment.",
    sample: "08:30 — the time you set. Honour it.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, load } = useUser();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [tone, setTone] = useState<Tone>("coach");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  // Pre-fill name/handle from Google profile if available
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }: { data: { user: { user_metadata?: Record<string, string> } | null } }) => {
      if (!data.user) return;
      const fullName = data.user.user_metadata?.full_name as string | undefined;
      if (fullName && !name) setName(fullName);
      if (!handle) {
        const suggested = (data.user.user_metadata?.name as string | undefined)
          ?.toLowerCase().replace(/\s+/g, "") ?? "";
        if (suggested) setHandle(suggested);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    if (!name.trim() || !handle.trim()) return;
    setSubmitting(true);
    try {
      const h = handle.trim().toLowerCase();
      // Ensure the cloud profile exists and is bound to this auth user.
      // We use auth.uid() (uuid) as the stable user_profile.id across devices.
      const sb = supabaseBrowser();
      if (sb) {
        const { data } = await sb.auth.getUser();
        const authUid = data.user?.id;
        if (authUid) {
          const { error: upsertErr } = await sb.from("user_profile").upsert({
            id: authUid,
            auth_user_id: authUid,
            handle: h,
            display_name: name.trim(),
            class_name: "polymath",
            tone,
            // Don't overwrite progress fields if the user is re-onboarding / retrying.
            // (Supabase defaults handle the initial values on first insert.)
            created_at: Date.now(),
            updated_at: Date.now(),
          });
          if (upsertErr) throw upsertErr;
        }
      }
      await seedStarter({
        className: "polymath",
        handle: h,
        displayName: name.trim(),
        tone,
        selectedGoalKeys: [],
      });
      // Seed personal goals when the handle is "vishrudh" OR the Google
      // account is vishrudh.shrinivas@gmail.com
      let googleEmail = "";
      if (sb) {
        const { data } = await sb.auth.getUser();
        googleEmail = data.user?.email ?? "";
      }
      if (h === "vishrudh" || googleEmail === "vishrudh.shrinivas@gmail.com") {
        await seedVishrudh();
      }
      await useUser.getState().load();
      router.replace("/");
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      alert("Setup failed. Try again.");
    }
  }

  const STEPS = [
    {
      title: "Life OS",
      subtitle:
        "A personal operating system for your goals. Pipeline any ambition into habits, trackers, and weekly reviews — then compound the work.",
      next: "Begin",
      canNext: true,
      content: (
        <div className="os-block-strong p-4 mt-2 space-y-3">
          {[
            ["01", "Set a goal — define its why, outcome, and metric."],
            ["02", "Break it down — typed habits: do / count / time / checklist."],
            ["03", "Track what matters — progress photos, weight, mood."],
            ["04", "Review weekly — keep, cut, or adjust."],
          ].map(([n, t]) => (
            <div key={n} className="flex items-start gap-3 text-[13px] text-[var(--ink-2)]">
              <span className="font-mono text-[var(--accent)] shrink-0">{n}</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Identify",
      subtitle: "Your alias in the system.",
      next: "Next",
      canNext: name.trim().length > 0 && handle.trim().length > 1,
      content: (
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              autoFocus
              value={name}
              placeholder="Vish"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Handle</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-lg bg-[var(--surface-2)] border border-r-0 border-[var(--border)] text-[var(--ink-3)] text-sm font-mono">
                @
              </span>
              <Input
                value={handle}
                placeholder="vish"
                onChange={(e) =>
                  setHandle(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())
                }
                className="rounded-l-none"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Voice",
      subtitle: "When you slip, what voice gets you back on track?",
      next: submitting ? "Setting up…" : "Boot Life OS",
      canNext: !submitting,
      content: (
        <div className="space-y-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={cn(
                "w-full text-left os-block p-3 transition",
                tone === t.value &&
                  "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-[var(--ink-1)]">{t.label}</span>
                <span className="text-[11px] text-[var(--ink-3)] font-mono">{t.hint}</span>
              </div>
              <div className="text-[12px] text-[var(--ink-2)] italic">
                &quot;{t.sample}&quot;
              </div>
            </button>
          ))}
          <p className="text-[11px] text-[var(--ink-3)] font-mono pt-1">
            you can change this any time in settings.
          </p>
        </div>
      ),
    },
  ];

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-md min-h-[100dvh] px-5 pt-10 pb-10 flex flex-col">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="os-label">Life OS · setup</span>
        <span className="os-label">
          {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </span>
      </div>

      {/* progress bar */}
      <div className="mb-6 flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all",
              i <= step ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="mb-6">
          <h1 className="serif text-4xl text-[var(--ink-1)]">{cur.title}</h1>
          <p className="text-sm text-[var(--ink-2)] mt-2 leading-relaxed">
            {cur.subtitle}
          </p>
        </div>
        <div className="flex-1">{cur.content}</div>
      </div>

      <div className="pt-4 flex gap-2">
        {step > 0 && (
          <Button
            variant="secondary"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1"
          >
            Back
          </Button>
        )}
        <Button
          size="lg"
          disabled={!cur.canNext}
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          className="flex-[2]"
        >
          {cur.next} {!isLast && <ArrowRight size={18} />}
        </Button>
      </div>
    </div>
  );
}
