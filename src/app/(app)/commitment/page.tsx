"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { AdherenceProfile } from "@/types";

export default function CommitmentPage() {
  const router = useRouter();
  const { user, setUser, load } = useUser();
  const habits = useLiveQuery(
    () => db().habits.filter((h) => !h.archived && !h.deletedAt).toArray(),
    []
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [why, setWhy] = useState("");
  const [repair, setRepair] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.adherence?.commitmentHabitIds?.length) return;
    setPicked(new Set(user.adherence.commitmentHabitIds));
    if (user.adherence.commitmentWhy) setWhy(user.adherence.commitmentWhy);
    if (user.adherence.commitmentRepair) setRepair(user.adherence.commitmentRepair);
  }, [user?.adherence?.commitmentHabitIds, user?.adherence?.commitmentWhy, user?.adherence?.commitmentRepair]);

  if (!user || habits === undefined) {
    return (
      <div className="px-5 pt-10 space-y-3">
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    );
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else if (n.size < 3) n.add(id);
      return n;
    });
  }

  async function save(skip: boolean) {
    if (!skip && picked.size === 0) return;
    const u = useUser.getState().user;
    if (!u) return;
    setSaving(true);
    const t = Date.now();
    const nextAd: AdherenceProfile = {
      ...(u.adherence ?? {}),
      commitmentHabitIds: skip ? [] : Array.from(picked).slice(0, 3),
      commitmentWhy: skip ? undefined : why.trim() || undefined,
      commitmentRepair: skip ? undefined : repair.trim() || undefined,
      commitmentCompletedAt: t,
      commitmentSkipped: skip,
    };
    await setUser({
      ...u,
      adherence: nextAd,
      updatedAt: t,
    });
    router.replace("/");
    setSaving(false);
  }

  return (
    <div className="px-5 pt-8 pb-16 space-y-6 max-w-md mx-auto">
      <div>
        <div className="os-label">Serious mode</div>
        <h1 className="serif text-3xl text-[var(--ink-1)] mt-1">Commit</h1>
        <p className="text-sm text-[var(--ink-3)] mt-2 leading-relaxed">
          Pick up to three habits you refuse to negotiate on this season. Write why they matter.
          This is for you — the app will surface a tiny weekly check-in.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Non-negotiables (max 3)</Label>
        <div className="space-y-1.5">
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => toggle(h.id)}
              className={cn(
                "w-full text-left os-block px-3 py-2.5 rounded-xl border transition",
                picked.has(h.id)
                  ? "border-[var(--accent)] bg-[var(--accent)]/[0.08]"
                  : "border-[var(--border)] hover:border-[var(--accent)]/40"
              )}
            >
              <span className="text-sm font-medium text-[var(--ink-1)]">{h.title}</span>
              {h.scheduledTime && (
                <span className="ml-2 font-mono text-[10px] text-[var(--ink-3)]">{h.scheduledTime}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Why these matter (one line)</Label>
        <Textarea
          rows={2}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="So I have energy before work…"
          className="mt-1"
        />
      </div>

      <div>
        <Label>If I miss twice in a week, I will… (optional)</Label>
        <Textarea
          rows={2}
          value={repair}
          onChange={(e) => setRepair(e.target.value)}
          placeholder="Do a 10-minute repair session Sunday evening — no drama, just repair."
          className="mt-1"
        />
        <p className="text-[10px] text-[var(--ink-3)] font-mono mt-1">
          Keep it behavioural — not money/legal promises.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          loading={saving}
          disabled={picked.size === 0}
          onClick={() => void save(false)}
        >
          Save commitment
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => void save(true)}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
