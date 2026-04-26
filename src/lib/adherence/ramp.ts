import { getISOWeek, getISOWeekYear } from "date-fns";
import { parseScheduledMinutes } from "@/lib/engine";
import type { Habit, HabitRamp } from "@/types";

function minutes(hhmm: string): number {
  return parseScheduledMinutes(hhmm) ?? 0;
}

export function minutesToHHmm(m: number): string {
  const x = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(x / 60);
  const mi = x % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** Move wake-style time earlier by `stepMin`, but not past `targetHHmm`. */
export function shiftWakeEarlier(
  currentHHmm: string,
  targetHHmm: string,
  stepMin: number
): string {
  const c = minutes(currentHHmm);
  const t = minutes(targetHHmm);
  if (c <= t) return minutesToHHmm(t);
  const delta = Math.min(Math.max(1, stepMin), c - t);
  return minutesToHHmm(c - delta);
}

export function isoWeekKey(d: Date = new Date()): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

export function rampNeedsWeeklyPrompt(habit: Habit, now: Date = new Date()): boolean {
  const r = habit.ramp;
  if (!r?.enabled || r.mode !== "weekly") return false;
  if (!habit.scheduledTime || !r.targetTime) return false;
  const wk = isoWeekKey(now);
  if (r.lastAdjustedWeekKey === wk) return false;
  const cur = minutes(habit.scheduledTime);
  const tgt = minutes(r.targetTime);
  if (cur <= tgt) return false;
  return true;
}

export function defaultRamp(
  partial?: Partial<HabitRamp> & { targetTime: string }
): HabitRamp {
  return {
    enabled: true,
    targetTime: partial!.targetTime,
    stepMinutes: partial?.stepMinutes ?? 15,
    mode: partial?.mode ?? "weekly",
    afterStreakDays: partial?.afterStreakDays ?? 5,
    lastAdjustedWeekKey: partial?.lastAdjustedWeekKey,
    successStreakDays: partial?.successStreakDays ?? 0,
  };
}
