"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Cadence } from "@/types";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, ChevronRight } from "lucide-react";
import { addDays, startOfWeek } from "date-fns";
import { db } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { habitDoneToday, isHabitDueToday } from "@/lib/engine";
import { todayISO, cn } from "@/lib/utils";
import type { Habit } from "@/types";

// Derive a sensible weekly target from cadence when the user hasn't set one.
function cadenceWeeklyDefault(cadence: Cadence, customDays?: number[]): number {
  if (cadence === "daily")    return 7;
  if (cadence === "alt-days") return 4;
  if (cadence === "weekly")   return 1;
  if (cadence === "custom")   return customDays?.length ?? 5;
  return 7;
}

const AREA_LABELS: Record<string, string> = {
  career: "Career",
  health: "Health",
  mind: "Mind",
  wealth: "Wealth",
  craft: "Craft",
  relationships: "Relationships",
  lifestyle: "Lifestyle",
};

const KIND_GLYPH: Record<Habit["kind"], string> = {
  binary: "·",
  count: "#",
  duration: "⏱",
  checklist: "☰",
};

function weeklyStats(habit: Habit, logs: import("@/types").Log[]) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  let due = 0;
  let done = 0;
  let totalValue = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d > new Date()) break;
    const ds = d.toISOString().slice(0, 10);
    if (!isHabitDueToday(habit, d)) continue;
    due++;
    const r = habitDoneToday(habit, logs, ds);
    if (r.done) done++;
    totalValue += r.value;
  }
  return { due, done, totalValue };
}

export default function GoalsPage() {
  const habits = useLiveQuery(
    () => db().habits.filter((h) => !h.archived && !h.deletedAt).toArray(),
    []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);

  const today = todayISO();

  const rows = useMemo(() => {
    if (!habits || !logs) return [];
    return habits.map((h) => {
      const stats = weeklyStats(h, logs);
      const todayStatus = habitDoneToday(h, logs, today);
      const dueToday = isHabitDueToday(h);
      return { habit: h, stats, todayStatus, dueToday };
    });
  }, [habits, logs, today]);

  // Group by area
  const byArea = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const area = (r.habit as Habit & { area?: string }).area ?? "other";
      const arr = map.get(area) ?? [];
      arr.push(r);
      map.set(area, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="os-label">Your system</div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">Goals</h1>
        </div>
        <Link href="/goals/new">
          <Button size="sm">
            <Plus size={14} /> new
          </Button>
        </Link>
      </div>

      {rows.length === 0 && (
        <div className="os-block p-8 text-center">
          <div className="serif text-2xl text-[var(--ink-3)] mb-1">Empty.</div>
          <p className="text-sm text-[var(--ink-3)] mb-4">
            Add your first goal to start building your system.
          </p>
          <Link href="/goals/new">
            <Button>
              <Plus size={14} /> First goal
            </Button>
          </Link>
        </div>
      )}

      {byArea.map(([area, areaRows]) => (
        <div key={area} className="space-y-1.5">
          <div className="os-label">{AREA_LABELS[area] ?? area}</div>
          {areaRows.map(({ habit, stats, todayStatus, dueToday }) => {
              const color = habit.color ?? "var(--accent)";

            // weeklyTarget overrides cadence-derived count; never use elapsed-days count
            const displayTarget =
              habit.weeklyTarget ??
              cadenceWeeklyDefault(habit.cadence, habit.customDays);
            const displayPct = displayTarget > 0
              ? Math.min(1, stats.done / displayTarget) : 0;

            return (
              <Link href={`/goals/${habit.id}`} key={habit.id} className="block">
                <div
                  className={cn(
                    "os-block px-3.5 py-3 hover:border-[var(--border-strong)] transition",
                    dueToday && todayStatus.done && "border-[var(--accent)]/30"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {/* colour dot */}
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-[var(--ink-1)]">
                        {habit.title}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--ink-3)] mt-0.5">
                        {KIND_GLYPH[habit.kind]}{" "}
                        {habit.kind === "binary"
                          ? "do / don't"
                          : habit.kind === "checklist"
                            ? `${habit.steps?.length ?? habit.target} steps`
                            : `${habit.target}${habit.unit ? " " + habit.unit : ""} ${habit.targetMode}`}
                        {" · "}
                        {habit.cadence}
                      </div>
                    </div>
                    {/* today badge */}
                    {dueToday && (
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                          todayStatus.done
                            ? "border-[var(--success)]/40 text-[var(--success)]"
                            : "border-[var(--warn)]/40 text-[var(--warn)]"
                        )}
                      >
                        {todayStatus.done ? "done" : "due"}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-[var(--ink-3)]" />
                  </div>

                  {/* weekly progress bar */}
                  {displayTarget > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${displayPct * 100}%`, background: color }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[var(--ink-3)] tabular-nums">
                        {stats.done}/{displayTarget} this wk
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
