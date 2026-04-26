"use client";

import { useState } from "react";
import type { AdherenceProfile } from "@/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { isoWeekKey } from "@/lib/adherence/ramp";

type Response = "yes" | "partial" | "no";

export function WeeklyReviewCard({
  adherence,
  onSave,
}: {
  adherence?: AdherenceProfile;
  onSave: (next: AdherenceProfile) => Promise<void>;
}) {
  const week = isoWeekKey(new Date());
  if (adherence?.weeklyReviewWeekKey === week) return null;

  const [resp, setResp] = useState<Response | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!resp) return;
    setSaving(true);
    try {
      await onSave({
        ...adherence,
        weeklyReviewWeekKey: week,
        weeklyReviewResponse: resp,
        weeklyReviewNote: note.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="os-block p-4 space-y-3 border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04]">
      <div className="os-label text-[var(--accent)]">Weekly check-in</div>
      <p className="text-sm text-[var(--ink-2)] leading-relaxed">
        Did your non‑negotiables hold this week? One tap, optional note.
      </p>
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["yes", "Mostly yes"],
            ["partial", "Mixed"],
            ["no", "Not really"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setResp(k)}
            className={`flex-1 min-w-[88px] h-9 rounded-lg border text-xs font-medium transition ${
              resp === k
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--ink-1)]"
                : "border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        placeholder="One sentence (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="text-sm"
      />
      <Button size="sm" className="w-full" disabled={!resp} loading={saving} onClick={() => void submit()}>
        Save check-in
      </Button>
    </div>
  );
}
