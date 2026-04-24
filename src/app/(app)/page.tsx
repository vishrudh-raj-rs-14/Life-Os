"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { Plus } from "lucide-react";
import type { Habit, Log } from "@/types";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { useTimer } from "@/store/useTimer";
import { HeaderBar } from "@/components/today/HeaderBar";
import { QuestCard } from "@/components/today/QuestCard";
import { ActiveTimerCard } from "@/components/today/ActiveTimerCard";
import { habitDoneToday, isHabitDueToday, xpForHabit } from "@/lib/engine";
import { LOCAL_USER_ID, nowMs, todayISO, vibrate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export default function TodayPage() {
  const { user, awardXp, bumpStreak, load } = useUser();
  const timer = useTimer();
  const [today] = useState(todayISO());

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

  if (!user) return null;

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
      await db().logs.add(stampedLog(h, today, delta, xp, t));
      const r = await awardXp(xp);
      await bumpStreak();
      vibrate(10);
      if (r.leveledUp) {
        toast({ emoji: "⏶", title: `Level ${r.newLevel}` });
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
          remaining = 0;
        }
      }
      if (xpToRefund > 0) await awardXp(-xpToRefund);
    }
  }

  async function toggleBinary(h: Habit) {
    const { done } = habitDoneToday(h, todayLogs ?? [], today);
    if (done) {
      const todays = (todayLogs ?? []).filter((l) => l.habitId === h.id);
      for (const l of todays) {
        await db().logs.delete(l.id);
        if (l.xpAwarded) await awardXp(-l.xpAwarded);
      }
      vibrate(10);
      return;
    }
    const xp = xpForHabit(h, 1);
    const t = nowMs();
    await db().logs.add(stampedLog(h, today, 1, xp, t));
    const r = await awardXp(xp);
    await bumpStreak();
    vibrate([20, 30, 40]);
    if (r.leveledUp) {
      toast({ emoji: "⏶", title: `Level ${r.newLevel}` });
    } else {
      toast({ emoji: "✓", title: `+${xp} XP`, description: h.title });
    }
  }

  async function toggleStep(h: Habit, idx: number) {
    const todays = (todayLogs ?? []).filter((l) => l.habitId === h.id);
    let log = todays[0];
    if (!log) {
      const t = nowMs();
      const newLog: Log = stampedLog(h, today, 0, 0, t, []);
      await db().logs.add(newLog);
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
    <div className="space-y-5">
      <HeaderBar user={user} />

      {timer.goalId && timer.startedAt && activeGoal && (
        <div className="px-5">
          <ActiveTimerCard goal={activeGoal} startedAt={timer.startedAt} />
        </div>
      )}

      <section className="px-5">
        <SectionHeader
          title="Now"
          right={
            <span className="font-mono text-[11px] text-[var(--ink-3)]">
              {completedCount}/{dueHabits.length} · +{totalXpToday} xp
            </span>
          }
        />

        {dueHabits.length === 0 && optionalHabits.length === 0 ? (
          <EmptyToday />
        ) : (
          <div className="space-y-2">
            {dueHabits.map((h) => {
              const { done, value, progress } = habitDoneToday(
                h,
                todayLogs ?? [],
                today
              );
              const todayLog = (todayLogs ?? []).find((l) => l.habitId === h.id);
              return (
                <QuestCard
                  key={h.id}
                  habit={h}
                  value={value}
                  done={done}
                  progress={progress}
                  xp={xpForHabit(h, h.target)}
                  todayStepsMask={todayLog?.steps}
                  recent={stripFor(h)}
                  onLog={(delta) => void logQuantity(h, delta)}
                  onToggleBinary={() => void toggleBinary(h)}
                  onToggleStep={(i) => void toggleStep(h, i)}
                />
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
                    <QuestCard
                      key={h.id}
                      habit={h}
                      optional
                      value={value}
                      done={done}
                      progress={progress}
                      xp={xpForHabit(h, h.target)}
                      todayStepsMask={todayLog?.steps}
                      recent={stripFor(h)}
                      onLog={(delta) => void logQuantity(h, delta)}
                      onToggleBinary={() => void toggleBinary(h)}
                      onToggleStep={(i) => void toggleStep(h, i)}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}
      </section>

    </div>
  );
}

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="serif text-xl text-[var(--ink-1)]">{title}</h2>
      {right}
    </div>
  );
}

function EmptyToday() {
  return (
    <div className="os-block p-5 text-center">
      <div className="os-label">Inbox zero</div>
      <p className="text-sm text-[var(--ink-2)] my-3">
        No quests scheduled for today. Pipeline a goal to start compounding.
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
  steps?: number[]
): Log {
  return {
    id: nanoid(),
    userId: LOCAL_USER_ID,
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
