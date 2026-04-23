"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { Pause, Play, Square, Zap } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { useTimer } from "@/store/useTimer";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { RingProgress } from "@/components/ui/Progress";
import {
  LOCAL_USER_ID,
  fmtMinutes,
  nowMs,
  todayISO,
  vibrate,
} from "@/lib/utils";
import {
  applyCompound,
  isHabitDueToday,
  xpForHabit,
  xpForSession,
} from "@/lib/engine";
import { toast } from "@/components/ui/Toast";

const PRESETS = [25, 45, 60, 90];

function FocusInner() {
  const params = useSearchParams();
  const router = useRouter();
  const timer = useTimer();
  const { awardXp, bumpStreak } = useUser();

  const [now, setNow] = useState(() => Date.now());
  const [chosenGoalId, setChosenGoalId] = useState<string | undefined>(
    params.get("goalId") ?? undefined
  );
  const [target, setTarget] = useState<number>(45);

  useEffect(() => {
    timer.hydrate();
  }, [timer]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  const goals = useLiveQuery(
    () => db().habits.filter((h) => !h.archived && !h.deletedAt).toArray(),
    []
  );

  const activeGoalId = timer.goalId ?? chosenGoalId;
  const activeGoal = useMemo(
    () => goals?.find((g) => g.id === activeGoalId),
    [goals, activeGoalId]
  );

  const elapsedSec = timer.startedAt ? Math.floor((now - timer.startedAt) / 1000) : 0;
  const targetSec = target * 60;
  const progress = timer.startedAt ? Math.min(1, elapsedSec / targetSec) : 0;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;

  function start() {
    if (!activeGoalId) return;
    vibrate(20);
    timer.start(activeGoalId);
  }

  async function stop() {
    const result = timer.stop();
    if (!result) return;
    vibrate([15, 30, 15]);
    const goal = goals?.find((g) => g.id === result.goalId);
    const all = await db()
      .sessions.filter((s) => s.goalId === result.goalId && !s.deletedAt)
      .toArray();
    // compound multiplier based on session history for this goal (habit)
    const weeks = all.length >= 3 ? 1 : 0; // simplified: bonus after 3+ sessions
    const baseXp = xpForSession(result.minutes);
    const xp = applyCompound(baseXp, weeks);

    const t = nowMs();
    await db().sessions.add({
      id: nanoid(),
      userId: LOCAL_USER_ID,
      goalId: result.goalId,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      minutes: result.minutes,
      notes: result.notes || undefined,
      xpAwarded: xp,
      createdAt: t,
      updatedAt: t,
    });

    // Auto-credit any duration habit attached to this goal that is due today.
    let creditedHabitTitle: string | undefined;
    let creditedXp = 0;
    const today = todayISO();
    const habits = await db()
      .habits.filter(
        (h) =>
          !h.archived &&
          !h.deletedAt &&
          h.goalId === result.goalId &&
          h.kind === "duration"
      )
      .toArray();
    for (const h of habits) {
      if (!isHabitDueToday(h)) continue;
      const habitXp = xpForHabit(h, result.minutes);
      const lt = nowMs();
      await db().logs.add({
        id: nanoid(),
        userId: LOCAL_USER_ID,
        habitId: h.id,
        goalId: h.goalId,
        date: today,
        value: result.minutes,
        xpAwarded: habitXp,
        createdAt: lt,
        updatedAt: lt,
      });
      creditedHabitTitle = h.title;
      creditedXp += habitXp;
    }

    const r = await awardXp(xp + creditedXp);
    await bumpStreak();

    toast({
      emoji: r.leveledUp ? "⏶" : "✓",
      title: r.leveledUp ? `Level ${r.newLevel}` : `+${xp + creditedXp} XP`,
      description: `${fmtMinutes(result.minutes)} on ${goal?.title ?? "your goal"}${
        creditedHabitTitle ? ` · credited "${creditedHabitTitle}"` : ""
      }${weeks > 0 ? ` · ${weeks}w combo` : ""}`,
    });

    router.push("/");
  }

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="serif text-3xl text-[var(--ink-1)]">Focus</h1>
        {timer.startedAt && (
          <span className="text-[11px] os-label flex items-center gap-1.5">
            <span className="dot dot-on" /> live
          </span>
        )}
      </div>

      {!timer.startedAt && (
        <div className="space-y-2">
          <div className="os-label">Target a goal</div>
          <div className="grid grid-cols-2 gap-2">
            {(goals ?? []).map((g) => (
              <button
                key={g.id}
                onClick={() => setChosenGoalId(g.id)}
                className={`text-left os-block px-3 py-2.5 transition ${
                  chosenGoalId === g.id
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: g.color ?? "var(--accent)" }}
                  />
                  <span className="os-label normal-case">{(g as { area?: string }).area ?? g.kind}</span>
                </div>
                <div className="text-sm font-medium truncate">{g.title}</div>
                <div className="text-[11px] text-[var(--ink-3)] mt-0.5 font-mono">
                  {g.kind} · {g.cadence}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <RingProgress value={progress} size={260} stroke={12} color="var(--accent)">
          <div className="text-center">
            <div className="os-label mb-1">
              {activeGoal?.title ?? "pick a goal"}
            </div>
            <div className="font-mono text-6xl tabular-nums text-[var(--ink-1)]">
              {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </div>
            <div className="mt-2 os-label normal-case">target {target}m</div>
          </div>
        </RingProgress>

        {!timer.startedAt && (
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setTarget(p)}
                className={`px-3 h-9 rounded-md text-xs font-mono border transition ${
                  target === p
                    ? "bg-[var(--accent)]/10 border-[var(--accent)]/40 text-[var(--accent)]"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-2)]"
                }`}
              >
                {p}m
              </button>
            ))}
          </div>
        )}
      </div>

      {timer.startedAt && (
        <Textarea
          placeholder="What are you working on? (optional)"
          value={timer.notes}
          onChange={(e) => timer.setNotes(e.target.value)}
        />
      )}

      <AnimatePresence>
        {timer.startedAt && activeGoal && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-[var(--accent)]"
          >
            <Zap size={14} />
            <span className="text-sm font-medium font-mono">
              earning ~{xpForSession(Math.max(1, m))} xp
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 pt-2">
        {!timer.startedAt ? (
          <Button
            onClick={start}
            disabled={!activeGoalId}
            size="lg"
            className="flex-1"
          >
            <Play size={18} /> Start session
          </Button>
        ) : (
          <Button onClick={stop} variant="success" size="lg" className="flex-1">
            <Square size={18} /> Finish
          </Button>
        )}
      </div>

      {!timer.startedAt && (
        <p className="text-center text-[11px] text-[var(--ink-3)] leading-relaxed font-mono">
          phone in another room · notifications off · compound rewards
          consistency more than intensity
        </p>
      )}
      <span className="hidden">
        <Pause />
      </span>
    </div>
  );
}

export default function FocusPage() {
  return (
    <Suspense>
      <FocusInner />
    </Suspense>
  );
}
