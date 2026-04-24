import type { Difficulty, Goal, Habit, Log, Session } from "@/types";
import { differenceInCalendarDays, parseISO, startOfWeek } from "date-fns";

// ─── Levels ──────────────────────────────────────────────────────────────────

// Named level progression. Each array entry covers a range of levels.
// levelName(n) returns the title for that level.
const LEVEL_NAMES: [threshold: number, name: string][] = [
  [1, "Initiate"],
  [3, "Apprentice"],
  [6, "Practitioner"],
  [10, "Journeyman"],
  [15, "Specialist"],
  [20, "Expert"],
  [27, "Craftsman"],
  [35, "Master"],
  [45, "Grandmaster"],
  [60, "Legend"],
];

export function levelName(level: number): string {
  let name = "Initiate";
  for (const [threshold, title] of LEVEL_NAMES) {
    if (level >= threshold) name = title;
    else break;
  }
  return name;
}

// XP curve: gentle ramp so early levels feel fast.
// xpForLevel(L) = total XP required to reach level L from level 1.
// uses 100 * L^1.5 floor.
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

export function levelFromXp(totalXp: number): {
  level: number;
  name: string;
  xpInLevel: number;
  xpForNext: number;
  progress: number;
} {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpInLevel = totalXp - base;
  const xpForNext = next - base;
  return { level, name: levelName(level), xpInLevel, xpForNext, progress: xpInLevel / xpForNext };
}

// XP awarded for completing (or partially completing) a habit log.
// `value` is interpreted in the habit's unit (count/duration/binary/checklist).
export function xpForHabit(habit: Habit, value: number = 1): number {
  const diffMul: Record<number, number> = { 1: 5, 2: 10, 3: 18, 4: 28, 5: 40 };
  // Fallback so missing / out-of-range difficulty never produces NaN
  const mul    = diffMul[habit.difficulty] ?? 10;
  const target = Math.max(1, habit.target ?? 1);
  const val    = isFinite(value) ? value : 0;

  let progress = 0;
  switch (habit.kind) {
    case "binary":
      progress = val > 0 ? 1 : 0;
      break;
    case "count":
    case "checklist":
      progress = Math.min(1, val / target);
      break;
    case "duration":
      // duration is in minutes; reward proportional to target completion,
      // with a small bonus for going over.
      progress = Math.min(1.25, val / target);
      break;
    default:
      progress = val > 0 ? 1 : 0;
  }
  // For at-most habits (e.g. screen time), invert: reward staying under.
  if (habit.targetMode === "at-most") {
    progress = val <= target ? 1 : Math.max(0, 1 - (val - target) / target);
  }
  return Math.round(mul * progress);
}

// XP awarded for a focus session (per minute)
export function xpForSession(minutes: number, goal?: Goal): number {
  // base 1.0 per minute, slight bonus for high-priority goals
  // (proxy: goals with weeklyTargetMinutes > 300)
  const priority = goal && goal.weeklyTargetMinutes > 300 ? 1.25 : 1.0;
  return Math.round(minutes * priority);
}

// Compound multiplier: consecutive weeks hitting weekly target
// 0 → 1.0, 1 → 1.1, 2 → 1.25, 3+ → 1.5 (cap)
export function compoundMultiplier(consecutiveWeeks: number): number {
  if (consecutiveWeeks <= 0) return 1.0;
  if (consecutiveWeeks === 1) return 1.1;
  if (consecutiveWeeks === 2) return 1.25;
  return 1.5;
}

export function applyCompound(xp: number, consecutiveWeeks: number): number {
  return Math.round(xp * compoundMultiplier(consecutiveWeeks));
}

// ─── Streak ──────────────────────────────────────────────────────────────────

// A "streak day" is defined as: ≥50% of habits due that day were completed.
// This mirrors Duolingo's philosophy — partial effort still counts.
export const STREAK_THRESHOLD = 0.5; // fraction of due habits needed

// Compute the active-date set from habits + logs.
// Returns a Set<yyyy-MM-dd> where each date had ≥50% completion.
export function buildStreakDates(habits: Habit[], logs: Log[]): Set<string> {
  // Collect all dates we have any log for.
  const allDates = new Set(logs.map((l) => l.date));
  const result = new Set<string>();

  for (const dateStr of allDates) {
    const dateObj = parseISO(dateStr);
    const due = habits.filter((h) => !h.archived && isHabitDueToday(h, dateObj));
    if (due.length === 0) continue;
    const done = due.filter(
      (h) => habitDoneToday(h, logs, dateStr).done
    ).length;
    if (done / due.length >= STREAK_THRESHOLD) {
      result.add(dateStr);
    }
  }
  return result;
}

// Compute streak from a set of "active" dates (where threshold was met).
export function computeStreak(
  activeDates: Set<string>,
  today: string
): number {
  let cursor = parseISO(today);
  let streak = 0;
  while (true) {
    const d = format(cursor);
    if (activeDates.has(d)) {
      streak++;
      cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
    } else {
      break;
    }
  }
  return streak;
}

function format(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Weekly minutes for a goal from sessions
export function weekMinutes(
  sessions: Session[],
  goalId: string,
  weekStart: Date
): number {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 }).getTime();
  const end = start + 7 * 24 * 3600 * 1000;
  return sessions
    .filter(
      (s) =>
        s.goalId === goalId && s.startedAt >= start && s.startedAt < end
    )
    .reduce((acc, s) => acc + s.minutes, 0);
}

// Number of consecutive prior weeks where weeklyTarget was hit
export function consecutiveWeeksHit(
  sessions: Session[],
  goal: Goal,
  asOf: Date = new Date()
): number {
  let weeks = 0;
  // walk backwards starting from previous week (we don't count current incomplete week)
  let weekRefStart = startOfWeek(asOf, { weekStartsOn: 1 });
  weekRefStart = new Date(weekRefStart.getTime() - 7 * 24 * 3600 * 1000);
  while (true) {
    const m = weekMinutes(sessions, goal.id, weekRefStart);
    if (m >= goal.weeklyTargetMinutes && goal.weeklyTargetMinutes > 0) {
      weeks++;
      weekRefStart = new Date(
        weekRefStart.getTime() - 7 * 24 * 3600 * 1000
      );
    } else {
      break;
    }
  }
  return weeks;
}

// Should this habit appear today?
export function isHabitDueToday(habit: Habit, today: Date = new Date()): boolean {
  const dow = today.getDay(); // 0 = Sun … 6 = Sat
  if (habit.cadence === "daily") return true;

  // ALL non-daily cadences: if the user picked specific days, use those.
  // This covers "alt-days", "weekly", and "custom" uniformly.
  if (habit.customDays && habit.customDays.length > 0) {
    return habit.customDays.includes(dow);
  }

  // Legacy fallbacks for habits created before the day-picker existed.
  if (habit.cadence === "weekly")   return dow === 1;        // Monday
  if (habit.cadence === "alt-days") {
    const start = new Date(today.getFullYear(), 0, 0);
    const diff  = today.getTime() - start.getTime();
    const day   = Math.floor(diff / (1000 * 60 * 60 * 24));
    return day % 2 === 0;
  }
  return false;
}

// Whether a habit was completed today given its logs.
// Returns the aggregated `value` for the day and whether it satisfies the
// target according to the habit's targetMode.
export function habitDoneToday(
  habit: Habit,
  logs: Log[],
  todayStr: string
): { done: boolean; value: number; progress: number } {
  const todays = logs.filter(
    (l) => l.habitId === habit.id && l.date === todayStr && !l.deletedAt
  );
  // Sum value across logs (count/duration). For binary, keep max (1).
  const value =
    habit.kind === "binary"
      ? todays.length > 0
        ? 1
        : 0
      : todays.reduce((a, l) => a + (l.value ?? 0), 0);
  const target = Math.max(1, habit.target ?? 1);
  const progress = Math.min(1, value / target);
  let done = false;
  if (habit.targetMode === "at-most") done = value <= target && todays.length > 0;
  else if (habit.targetMode === "exactly") done = value === target;
  else done = value >= target;
  return { done, value, progress };
}

// Days since a date (ISO)
export function daysSince(iso: string, asOf: Date = new Date()): number {
  return differenceInCalendarDays(asOf, parseISO(iso));
}
