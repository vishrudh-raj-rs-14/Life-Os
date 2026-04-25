"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import { nanoid } from "nanoid";
import { Pause, Play, RotateCcw, Square, Zap } from "lucide-react";
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
  isHabitDueToday,
  xpForHabit,
} from "@/lib/engine";
import { toast } from "@/components/ui/Toast";
import { useFocusMediaSession } from "@/hooks/useFocusMediaSession";

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

  // Keep screen awake during a session (best-effort)
  useEffect(() => {
    if (!timer.startedAt) return;
    let lock: { release: () => Promise<unknown> } | undefined;
    const req = navigator.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      void req;
      void lock?.release();
    };
  }, [timer.startedAt]);

  const goals = useLiveQuery(
    () => db().habits.filter((h) => !h.archived && !h.deletedAt).toArray(),
    []
  );

  const activeGoalId = timer.goalId ?? chosenGoalId;
  const activeGoal = useMemo(
    () => goals?.find((g) => g.id === activeGoalId),
    [goals, activeGoalId]
  );

  const elapsedMs = timer.startedAt ? timer.elapsedMs(now) : 0;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const targetSec = target * 60;
  const progress = timer.startedAt ? Math.min(1, elapsedSec / targetSec) : 0;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const paused = !!timer.pausedAt;

  const finishRef = useRef<(() => Promise<void>) | null>(null);

  const onPlay = useCallback(() => {
    timer.resume();
    vibrate(10);
  }, [timer]);
  const onPause = useCallback(() => {
    timer.pause();
    vibrate(10);
  }, [timer]);
  const onStop = useCallback(() => {
    void finishRef.current?.();
  }, []);

  function start() {
    if (!activeGoalId) return;
    vibrate(20);
    timer.start(activeGoalId);
  }

  async function commitSession() {
    const result = timer.stop();
    if (!result) return;
    vibrate([15, 30, 15]);
    const u = useUser.getState().user;
    const userId = u?.userId ?? LOCAL_USER_ID;
    const goal = goals?.find((g) => g.id === result.goalId);
    const all = await db()
      .sessions.filter((s) => s.goalId === result.goalId && !s.deletedAt)
      .toArray();
    const weeks = all.length >= 3 ? 1 : 0;

    const t = nowMs();
    await db().sessions.add({
      id: nanoid(),
      userId,
      goalId: result.goalId,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      minutes: result.minutes,
      notes: result.notes || undefined,
      // Focus sessions are tracked for history, but XP is earned via habit logs
      // (duration goals) so we don't double-award.
      xpAwarded: 0,
      createdAt: t,
      updatedAt: t,
    });

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
        userId,
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

    // XP is granted only via credited duration habit logs (and manual duration logging).
    const r = await awardXp(creditedXp);
    await bumpStreak();

    toast({
      emoji: r.leveledUp ? "⏶" : "✓",
      title: r.leveledUp ? `Level ${r.newLevel}` : `+${creditedXp} XP`,
      description: `${fmtMinutes(result.minutes)} on ${goal?.title ?? "your goal"}${
        creditedHabitTitle ? ` · credited "${creditedHabitTitle}"` : ""
      }${weeks > 0 ? ` · ${weeks}w combo` : ""}`,
    });

    router.push("/");
  }

  async function finish() {
    if (elapsedSec < 1) {
      toast({
        emoji: "⏱",
        title: "Too short",
        description: "Run at least a few seconds before finishing.",
      });
      return;
    }
    await commitSession();
  }

  finishRef.current = finish;

  useFocusMediaSession({
    active: !!timer.startedAt && !!activeGoal,
    paused,
    title: activeGoal?.title ?? "Focus",
    subtitle: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} · ${paused ? "paused" : "running"}`,
    onPlay,
    onPause,
    onStop,
  });

  function abandon() {
    if (!confirm("Discard this session? Nothing will be saved.")) return;
    vibrate(15);
    timer.discard();
    toast({ emoji: "—", title: "Session discarded", description: "No XP logged." });
  }

  if (goals === undefined) {
    return (
      <div className="px-5 pt-6 pb-10 space-y-4">
        <div className="skeleton h-9 w-32 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-12 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="serif text-3xl text-[var(--ink-1)]">Focus</h1>
        {timer.startedAt && (
          <span className="text-[11px] os-label flex items-center gap-1.5">
            <span className={paused ? "dot dot-off" : "dot dot-on"} />
            {paused ? "paused" : "live"}
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
                type="button"
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
                type="button"
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
              focus builds time — XP is credited when you log the duration goal
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2 pt-2">
        {!timer.startedAt ? (
          <Button
            onClick={start}
            disabled={!activeGoalId}
            size="lg"
            className="w-full"
          >
            <Play size={18} /> Start session
          </Button>
        ) : (
          <>
            <div className="flex gap-2">
              {paused ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    timer.resume();
                    vibrate(10);
                  }}
                >
                  <Play size={18} /> Resume
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    timer.pause();
                    vibrate(10);
                  }}
                >
                  <Pause size={18} /> Pause
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void finish()}
                variant="success"
                size="lg"
                className="flex-[1.2]"
              >
                <Square size={18} /> Finish
              </Button>
            </div>
            <button
              type="button"
              onClick={abandon}
              className="w-full py-2 text-[11px] font-mono text-[var(--ink-3)] hover:text-[var(--warn)] flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={12} /> Abandon session (no save)
            </button>
          </>
        )}
      </div>

      {!timer.startedAt && (
        <p className="text-center text-[11px] text-[var(--ink-3)] leading-relaxed font-mono">
          Pause anytime · lock-screen controls where supported · deep work rewards
          consistency more than intensity
        </p>
      )}
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
