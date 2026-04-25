"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import type { Habit, Log } from "@/types";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { useTimer } from "@/store/useTimer";
import { HeaderBar } from "@/components/today/HeaderBar";
import { QuestCard } from "@/components/today/QuestCard";
import { ActiveTimerCard } from "@/components/today/ActiveTimerCard";
import { LevelUpOverlay } from "@/components/LevelUpOverlay";
import { GoalsList } from "@/components/goals/GoalsList";
import {
  dailyXpEarnedFromLogs,
  habitDoneToday,
  isHabitDueToday,
  levelName,
  maxDailyXpForHabit,
  xpForHabit,
} from "@/lib/engine";
import { nowMs, todayISO, vibrate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getRepo } from "@/lib/repo";

type Tab = "today" | "goals";

export default function TodayPage() {
  const { user, awardXp, bumpStreak, load, syncDailyXpBonus } = useUser();
  const timer = useTimer();
  const [today] = useState(todayISO());
  const [tab, setTab] = useState<Tab>("today");
  const [levelUp, setLevelUp] = useState<{ level: number; name: string } | null>(null);
  // Optimistic done state: habitId → true while the DB write is in-flight
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    timer.hydrate();
    void load();
  }, [load, timer]);

  const habits = useLiveQuery(
    () => db().habits.filter((h) => !h.archived && !h.deletedAt).toArray(),
    []
  );
  const todayLogs = useLiveQuery(
    () => db().logs.where("date").equals(today).toArray(),
    [today]
  );
  const recentLogs = useLiveQuery(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceISO = since.toISOString().slice(0, 10);
    return db().logs.where("date").aboveOrEqual(sinceISO).toArray();
  }, []);
  const activeGoal = useLiveQuery(
    async () => (timer.goalId ? db().habits.get(timer.goalId) : undefined),
    [timer.goalId]
  );

  const dueHabits = useMemo(() => {
    if (!habits) return [];
    return habits.filter((h) => isHabitDueToday(h));
  }, [habits]);

  // Alt-day habits on their off-day — show as optional / bonus
  const optionalHabits = useMemo(() => {
    if (!habits) return [];
    return habits.filter(
      (h) => h.cadence === "alt-days" && !isHabitDueToday(h)
    );
  }, [habits]);

  // --- pre-compute recent strips per habit ---------------------------------
  const last14 = useMemo(() => {
    const days: string[] = [];
    const d = new Date();
    for (let i = 13; i >= 0; i--) {
      const x = new Date(d);
      x.setDate(d.getDate() - i);
      days.push(x.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const dismissLevelUp = useCallback(() => setLevelUp(null), []);

  const dailyCap = useMemo(
    () => dueHabits.reduce((a, h) => a + maxDailyXpForHabit(h), 0),
    [dueHabits]
  );
  const dailyEarned = useMemo(() => {
    const ids = new Set(dueHabits.map((h) => h.id));
    return dailyXpEarnedFromLogs(todayLogs ?? [], today, ids);
  }, [dueHabits, todayLogs, today]);

  useEffect(() => {
    if (!user || todayLogs === undefined) return;
    void syncDailyXpBonus(today, dueHabits, todayLogs).then((res) => {
      if (res.leveledUp) {
        setLevelUp({ level: res.newLevel, name: levelName(res.newLevel) });
      } else if (res.delta > 0 && res.desiredBonus > 0) {
        toast({
          emoji: "✦",
          title: `+${res.delta} daily bonus XP`,
          description: "You maxed today's goal XP bar. It is removed if you drop below 100%.",
        });
      } else if (res.delta < 0) {
        toast({
          emoji: "↩",
          title: "Daily bonus withdrawn",
          description: "XP dropped below today's bar — bonus was removed to prevent gaming.",
        });
      }
    });
  }, [user, today, dueHabits, todayLogs, syncDailyXpBonus]);

  // Show skeleton while user profile or habits are loading
  if (!user || habits === undefined) {
    return (
      <div className="px-5 pt-6 pb-10 space-y-3">
        <div className="skeleton h-14 rounded-2xl mb-5" />
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }
  const userId = user.userId;

  const completedCount = dueHabits.filter((h) => {
    const { done } = habitDoneToday(h, todayLogs ?? [], today);
    return done;
  }).length;

  // --- log writers ----------------------------------------------------------

  async function logQuantity(h: Habit, delta: number) {
    if (delta === 0) return;
    if (delta > 0) {
      const xp = xpForHabit(h, delta);
      const t = nowMs();
      const log = stampedLog(h, today, delta, xp, t, userId);
      await db().logs.add(log);
      // Cloud-first: upsert to Supabase
      void getRepo().then((r) => r.upsertLog(log)).catch(() => {});
      const r = await awardXp(xp);
      await bumpStreak();
      vibrate(10);
      if (r.leveledUp) {
        setLevelUp({ level: r.newLevel, name: levelName(r.newLevel) });
      }
    } else {
      // remove |delta| worth of value from the most recent logs (or as much as possible)
      let remaining = -delta;
      const todays = (todayLogs ?? [])
        .filter((l) => l.habitId === h.id)
        .sort((a, b) => b.createdAt - a.createdAt);
      let xpToRefund = 0;
      for (const l of todays) {
        if (remaining <= 0) break;
        if (l.value <= remaining) {
          remaining -= l.value;
          xpToRefund += l.xpAwarded ?? 0;
          await db().logs.delete(l.id);
          void getRepo().then((r) => r.deleteLog(l.id)).catch(() => {});
        } else {
          // partial: split xp proportionally
          const newValue = l.value - remaining;
          const refund = Math.round((remaining / l.value) * (l.xpAwarded ?? 0));
          xpToRefund += refund;
          await db().logs.update(l.id, {
            value: newValue,
            xpAwarded: (l.xpAwarded ?? 0) - refund,
            updatedAt: nowMs(),
          });
          const updatedRow = await db().logs.get(l.id);
          if (updatedRow) void getRepo().then((r) => r.upsertLog(updatedRow)).catch(() => {});
          remaining = 0;
        }
      }
      if (xpToRefund > 0) await awardXp(-xpToRefund);
    }
  }

  async function toggleBinary(h: Habit) {
    const { done } = habitDoneToday(h, todayLogs ?? [], today);

    // Optimistic UI — flip immediately so button feels instant
    setOptimisticDone(prev => ({ ...prev, [h.id]: !done }));

    if (done) {
      const todays = (todayLogs ?? []).filter((l) => l.habitId === h.id);
      for (const l of todays) {
        await db().logs.delete(l.id);
        void getRepo().then((r) => r.deleteLog(l.id)).catch(() => {});
        if (l.xpAwarded) await awardXp(-l.xpAwarded);
      }
      vibrate(10);
      setOptimisticDone(prev => { const n = { ...prev }; delete n[h.id]; return n; });
      return;
    }
    const xp = xpForHabit(h, 1);
    const t = nowMs();
    const log = stampedLog(h, today, 1, xp, t, userId);
    await db().logs.add(log);
    void getRepo().then((r) => r.upsertLog(log)).catch(() => {});
    const r = await awardXp(xp);
    await bumpStreak();
    vibrate([20, 30, 40]);
    setOptimisticDone(prev => { const n = { ...prev }; delete n[h.id]; return n; });
    if (r.leveledUp) {
      setLevelUp({ level: r.newLevel, name: levelName(r.newLevel) });
    } else {
      toast({ emoji: "✓", title: `+${xp} XP`, description: h.title });
    }
  }

  async function toggleStep(h: Habit, idx: number) {
    const todays = (todayLogs ?? []).filter((l) => l.habitId === h.id);
    let log = todays[0];
    if (!log) {
      const t = nowMs();
      const newLog: Log = stampedLog(h, today, 0, 0, t, userId, []);
      await db().logs.add(newLog);
      void getRepo().then((r) => r.upsertLog(newLog)).catch(() => {});
      log = newLog;
    }
    const set = new Set(log.steps ?? []);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    const stepsArr = Array.from(set).sort((a, b) => a - b);
    const value = stepsArr.length;
    const previousXp = log.xpAwarded ?? 0;
    const xp = xpForHabit(h, value);
    await db().logs.update(log.id, {
      steps: stepsArr,
      value,
      xpAwarded: xp,
      updatedAt: nowMs(),
    });
    // Read back and upsert the updated row to cloud
    const updatedRow = await db().logs.get(log.id);
    if (updatedRow) void getRepo().then((r) => r.upsertLog(updatedRow)).catch(() => {});
    const diff = xp - previousXp;
    if (diff !== 0) await awardXp(diff);
    if (value >= h.target) await bumpStreak();
    vibrate(8);
  }

  const totalXpToday = (todayLogs ?? []).reduce(
    (a, l) => a + (l.xpAwarded ?? 0),
    0
  );

  function stripFor(h: Habit) {
    const map = new Map<string, number>();
    (recentLogs ?? [])
      .filter((l) => l.habitId === h.id)
      .forEach((l) => map.set(l.date, (map.get(l.date) ?? 0) + (l.value ?? 0)));
    return last14.map((d) => ({
      date: d,
      value: map.get(d) ?? 0,
      target: Math.max(1, h.target ?? 1),
    }));
  }

  return (
    <>
    {levelUp && (
      <LevelUpOverlay
        level={levelUp.level}
        levelName={levelUp.name}
        onDone={dismissLevelUp}
      />
    )}
    <div className="space-y-5">
      <HeaderBar
        user={user}
        dailyEarned={dailyEarned}
        dailyCap={dailyCap}
        dailyBonusActive={
          user.dailyBonusDate === today && (user.dailyBonusXp ?? 0) > 0
        }
      />

      {/* Tab switcher: Today / Goals */}
      <div className="px-5">
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          {(["today", "goals"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-8 rounded-lg text-xs font-mono uppercase tracking-wide transition-all ${
                tab === t
                  ? "bg-[var(--surface)] text-[var(--ink-1)] shadow-sm border border-[var(--border)]"
                  : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}
            >
              {t === "today" ? "Today" : "All Goals"}
            </button>
          ))}
        </div>
      </div>

      {tab === "goals" ? (
        <div className="px-5 pb-6">
          <GoalsList />
        </div>
      ) : (
      <>
      {timer.goalId && timer.startedAt && activeGoal && (
        <div className="px-5">
          {/* Timer UI reads pause/elapsed from useTimer inside the card */}
          <ActiveTimerCard goal={activeGoal} />
        </div>
      )}

      <section className="px-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="serif text-xl text-[var(--ink-1)]">Now</h2>
          <span className="font-mono text-[11px] text-[var(--ink-3)]">
            {completedCount}/{dueHabits.length} · +{totalXpToday} xp
          </span>
        </div>

        {dueHabits.length === 0 && optionalHabits.length === 0 ? (
          <EmptyToday />
        ) : (
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {dueHabits.map((h) => {
              const { done, value, progress } = habitDoneToday(
                h,
                todayLogs ?? [],
                today
              );
              const todayLog = (todayLogs ?? []).find((l) => l.habitId === h.id);
              return (
                <motion.div
                  key={h.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                >
                  <QuestCard
                    habit={h}
                    value={value}
                    done={h.id in optimisticDone ? optimisticDone[h.id] : done}
                    progress={progress}
                    xp={xpForHabit(h, h.target)}
                    todayStepsMask={todayLog?.steps}
                    recent={stripFor(h)}
                    onLog={(delta) => void logQuantity(h, delta)}
                    onToggleBinary={() => void toggleBinary(h)}
                    onToggleStep={(i) => void toggleStep(h, i)}
                  />
                </motion.div>
              );
            })}

            {/* Alt-day habits on their off day — bonus / optional */}
            {optionalHabits.length > 0 && (
              <>
                {dueHabits.length > 0 && (
                  <div className="pt-1 pb-0.5">
                    <span className="os-label">bonus today</span>
                  </div>
                )}
                {optionalHabits.map((h) => {
                  const { done, value, progress } = habitDoneToday(
                    h,
                    todayLogs ?? [],
                    today
                  );
                  const todayLog = (todayLogs ?? []).find((l) => l.habitId === h.id);
                  return (
                    <motion.div
                      key={h.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    >
                      <QuestCard
                        habit={h}
                        optional
                        value={value}
                        done={h.id in optimisticDone ? optimisticDone[h.id] : done}
                        progress={progress}
                        xp={xpForHabit(h, h.target)}
                        todayStepsMask={todayLog?.steps}
                        recent={stripFor(h)}
                        onLog={(delta) => void logQuantity(h, delta)}
                        onToggleBinary={() => void toggleBinary(h)}
                        onToggleStep={(i) => void toggleStep(h, i)}
                      />
                    </motion.div>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </section>
      </>
      )}  {/* end tab === "goals" ? ... : ( */}

    </div>
    </>
  );
}

function EmptyToday() {
  return (
    <div className="os-block p-5 text-center">
      <div className="os-label">Inbox zero</div>
      <p className="text-sm text-[var(--ink-2)] my-3">
        No goals due today. Add a goal to start building the system.
      </p>
      <Link href="/goals/new">
        <Button>
          <Plus size={16} /> New goal
        </Button>
      </Link>
    </div>
  );
}

function stampedLog(
  h: Habit,
  date: string,
  value: number,
  xp: number,
  t: number,
  userId: string,
  steps?: number[]
): Log {
  return {
    id: nanoid(),
    userId,
    habitId: h.id,
    goalId: h.goalId,
    date,
    value,
    steps,
    xpAwarded: xp,
    createdAt: t,
    updatedAt: t,
  };
}
