"use client";

import { useState } from "react";
import type { Habit } from "@/types";
import { db } from "@/lib/db/dexie";
import { getRepo } from "@/lib/repo";
import { isoWeekKey, rampNeedsWeeklyPrompt, shiftWakeEarlier } from "@/lib/adherence/ramp";
import { Button } from "@/components/ui/Button";
import { useUser } from "@/store/useUser";
import { toast } from "@/components/ui/Toast";
import { nanoid } from "nanoid";
import { LOCAL_USER_ID } from "@/lib/utils";

export function RampWeekPrompt({ habits }: { habits: Habit[] }) {
  const { awardXp } = useUser();
  const pending = habits.filter((h) => rampNeedsWeeklyPrompt(h, new Date()));
  const [busyId, setBusyId] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function accept(h: Habit) {
    const r = h.ramp;
    if (!r?.targetTime || !h.scheduledTime) return;
    setBusyId(h.id);
    try {
      const nextTime = shiftWakeEarlier(h.scheduledTime, r.targetTime, r.stepMinutes ?? 15);
      const wk = isoWeekKey(new Date());
      const updated: Habit = {
        ...h,
        scheduledTime: nextTime,
        ramp: { ...r, lastAdjustedWeekKey: wk },
        updatedAt: Date.now(),
      };
      await db().habits.put(updated);
      const repo = await getRepo();
      await repo.upsertHabit(updated);

      const existing = await db().reminders.where("habitId").equals(h.id).first();
      if (existing) {
        await db().reminders.update(existing.id, { time: nextTime, updatedAt: Date.now() });
      } else if (nextTime) {
        await db().reminders.put({
          id: nanoid(),
          userId: h.userId ?? LOCAL_USER_ID,
          habitId: h.id,
          time: nextTime,
          tone: "coach",
          enabled: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      const { syncReminder } = await import("@/lib/notifications/syncReminder");
      await syncReminder({
        habitId: h.id,
        habitTitle: h.title,
        remindTime: nextTime,
        days: h.customDays?.length ? h.customDays : [0, 1, 2, 3, 4, 5, 6],
      });

      const ladderXp = 28;
      await awardXp(ladderXp);
      toast({
        emoji: "↯",
        title: "Wake window shifted",
        description: `${h.title} → ${nextTime} (−${r.stepMinutes ?? 15}m). +${ladderXp} ladder XP.`,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function snooze(h: Habit) {
    const r = h.ramp;
    if (!r) return;
    setBusyId(h.id);
    try {
      const wk = isoWeekKey(new Date());
      const updated: Habit = {
        ...h,
        ramp: { ...r, lastAdjustedWeekKey: wk },
        updatedAt: Date.now(),
      };
      await db().habits.put(updated);
      const repo = await getRepo();
      await repo.upsertHabit(updated);
      toast({
        emoji: "◷",
        title: "Ramp snoozed",
        description: "We’ll ask again next week.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="os-label">Progressive target</div>
      {pending.map((h) => {
        const r = h.ramp!;
        const next = shiftWakeEarlier(h.scheduledTime!, r.targetTime, r.stepMinutes ?? 15);
        return (
          <div key={h.id} className="os-block p-3 space-y-2">
            <p className="text-sm text-[var(--ink-2)]">
              <span className="font-medium text-[var(--ink-1)]">{h.title}</span>
              {" — "}
              move anchor from <span className="font-mono">{h.scheduledTime}</span> toward{" "}
              <span className="font-mono">{r.targetTime}</span>?
            </p>
            <p className="text-[11px] font-mono text-[var(--ink-3)]">
              Next step: <span className="text-[var(--accent)]">{next}</span> (−{r.stepMinutes ?? 15} min)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                loading={busyId === h.id}
                onClick={() => void accept(h)}
              >
                Accept step
              </Button>
              <Button size="sm" variant="ghost" disabled={busyId === h.id} onClick={() => void snooze(h)}>
                Snooze 1 week
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
