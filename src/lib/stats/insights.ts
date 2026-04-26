import { addDays, getISODay, startOfWeek } from "date-fns";
import type { Habit, LifeArea, Log } from "@/types";
import {
  computeStreak,
  habitDoneToday,
  isHabitDueToday,
  STREAK_THRESHOLD,
} from "@/lib/engine";

const MS_DAY = 86400000;
const SCAN_CAP_DAYS = 400;

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalISO(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function activeHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => !h.archived && !h.deletedAt);
}

/** Due habit slots vs completed that calendar day. */
export function dayDueDoneCounts(
  habits: Habit[],
  logs: Log[],
  dateISO: string
): { due: number; done: number } {
  const day = parseLocalISO(dateISO);
  let due = 0;
  let done = 0;
  for (const h of activeHabits(habits)) {
    if (!isHabitDueToday(h, day)) continue;
    due++;
    if (habitDoneToday(h, logs, dateISO).done) done++;
  }
  return { due, done };
}

/** Visual level for heatmap: -1 = no habits due, 0–4 = intensity from completion ratio. */
export function ratioToHeatLevel(due: number, done: number): { ratio: number | null; level: number } {
  if (due === 0) return { ratio: null, level: -1 };
  const r = done / due;
  if (r <= 0) return { ratio: r, level: 0 };
  if (r <= 0.25) return { ratio: r, level: 1 };
  if (r <= 0.5) return { ratio: r, level: 2 };
  if (r <= 0.75) return { ratio: r, level: 3 };
  return { ratio: r, level: 4 };
}

export interface HeatmapDay {
  date: string;
  due: number;
  done: number;
  ratio: number | null;
  level: number;
}

/** Last 90 calendar days ending `asOf` (local), oldest first. */
export function heatmap90Days(habits: Habit[], logs: Log[], asOf: Date = new Date()): HeatmapDay[] {
  const out: HeatmapDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = addDays(asOf, -i);
    const date = toLocalISO(d);
    const { due, done } = dayDueDoneCounts(habits, logs, date);
    const { ratio, level } = ratioToHeatLevel(due, done);
    out.push({ date, due, done, ratio, level });
  }
  return out;
}

/** Prefix nulls so oldest day aligns Monday row; suffix nulls to fill last column (GitHub-style grid). */
export function heatmapGridCells(days: HeatmapDay[]): (HeatmapDay | null)[] {
  if (days.length === 0) return [];
  const first = parseLocalISO(days[0].date);
  const prefix = getISODay(first) - 1;
  const core = [...Array(Math.max(0, prefix)).fill(null), ...days] as (HeatmapDay | null)[];
  const rem = core.length % 7;
  const suffix = rem === 0 ? 0 : 7 - rem;
  return [...core, ...Array(suffix).fill(null)];
}

/** Same due/done semantics as Stats `weekScore` (0–100). */
export function weekCompletionPct(
  habits: Habit[],
  logs: Log[],
  weekStartMonday: Date,
  asOf: Date = new Date()
): number {
  let due = 0;
  let done = 0;
  for (const h of activeHabits(habits)) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStartMonday, i);
      if (d > asOf) break;
      if (!isHabitDueToday(h, d)) continue;
      due++;
      const ds = toLocalISO(d);
      if (habitDoneToday(h, logs, ds).done) done++;
    }
  }
  return due > 0 ? Math.round((done / due) * 100) : 0;
}

export type WeekRateRow = { weekStart: string; label: string; pct: number };

export function weeklyCompletionRates(
  habits: Habit[],
  logs: Log[],
  asOf: Date = new Date(),
  numWeeks: number
): WeekRateRow[] {
  const thisWeekStart = startOfWeek(asOf, { weekStartsOn: 1 });
  const rows: WeekRateRow[] = [];
  for (let w = numWeeks - 1; w >= 0; w--) {
    const ws = addDays(thisWeekStart, -7 * w);
    const pct = weekCompletionPct(habits, logs, ws, asOf);
    const label = ws.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    rows.push({ weekStart: toLocalISO(ws), label, pct });
  }
  return rows;
}

/** Average of last `count` ISO week completion % (integer 0–100). */
export function averageWeeklyCompletion(
  habits: Habit[],
  logs: Log[],
  asOf: Date,
  count: number
): number {
  const rows = weeklyCompletionRates(habits, logs, asOf, count);
  if (rows.length === 0) return 0;
  const sum = rows.reduce((a, r) => a + r.pct, 0);
  return Math.round(sum / rows.length);
}

export function xpThisCalendarMonth(logs: Log[], asOf: Date = new Date()): number {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  let sum = 0;
  for (const l of logs) {
    if (l.deletedAt) continue;
    const [ly, lm] = l.date.split("-").map(Number);
    if (ly === y && lm - 1 === m) sum += l.xpAwarded ?? 0;
  }
  return sum;
}

const TOD_BUCKETS = [
  { id: "night", label: "Night", range: "12am–6am", h0: 0, h1: 6 },
  { id: "morning", label: "Morning", range: "6am–12pm", h0: 6, h1: 12 },
  { id: "afternoon", label: "Afternoon", range: "12pm–5pm", h0: 12, h1: 17 },
  { id: "evening", label: "Evening", range: "5pm–10pm", h0: 17, h1: 22 },
  { id: "late", label: "Late", range: "10pm–12am", h0: 22, h1: 24 },
] as const;

export type TimeOfDayInsight = {
  label: string;
  range: string;
  count: number;
  xp: number;
} | null;

/** Logs in last `windowDays` by `createdAt`, weighted by count + XP. */
export function bestTimeOfDayBucket(
  logs: Log[],
  asOf: Date = new Date(),
  windowDays = 90
): { primary: TimeOfDayInsight; secondary: TimeOfDayInsight } {
  const cutoff = asOf.getTime() - windowDays * MS_DAY;
  const scores = TOD_BUCKETS.map((b) => ({
    ...b,
    count: 0,
    xp: 0,
  }));
  for (const l of logs) {
    if (l.deletedAt) continue;
    const t = l.createdAt;
    if (t < cutoff) continue;
    const d = new Date(t);
    const h = d.getHours() + d.getMinutes() / 60;
    for (const b of scores) {
      if (h >= b.h0 && h < b.h1) {
        b.count += 1;
        b.xp += l.xpAwarded ?? 0;
        break;
      }
    }
  }
  const ranked = [...scores].sort((a, b) => {
    const wa = a.count * 2 + a.xp * 0.01;
    const wb = b.count * 2 + b.xp * 0.01;
    return wb - wa;
  });
  const top = ranked[0];
  if (!top || top.count === 0) {
    return { primary: null, secondary: null };
  }
  const primary: TimeOfDayInsight = {
    label: top.label,
    range: top.range,
    count: top.count,
    xp: top.xp,
  };
  const sec = ranked[1];
  const secondary: TimeOfDayInsight =
    sec && sec.count > 0
      ? { label: sec.label, range: sec.range, count: sec.count, xp: sec.xp }
      : null;
  return { primary, secondary };
}

export type AreaXpRow = {
  area: LifeArea | "uncategorized";
  label: string;
  color: string;
  xp: number;
  pctOfMonth: number;
};

const UNCATEGORIZED: AreaXpRow["area"] = "uncategorized";

export function areaBreakdownThisMonth(
  habits: Habit[],
  logs: Log[],
  areaLabel: (a: LifeArea) => string,
  areaColor: (a: LifeArea) => string,
  asOf: Date = new Date()
): AreaXpRow[] {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const habitArea = new Map<string, LifeArea | "uncategorized">();
  for (const h of activeHabits(habits)) {
    const a = (h as Habit & { area?: LifeArea }).area;
    habitArea.set(h.id, a ?? UNCATEGORIZED);
  }
  const xpByArea = new Map<LifeArea | "uncategorized", number>();
  for (const l of logs) {
    if (l.deletedAt) continue;
    const [ly, lm] = l.date.split("-").map(Number);
    if (ly !== y || lm - 1 !== m) continue;
    const area = habitArea.get(l.habitId) ?? UNCATEGORIZED;
    xpByArea.set(area, (xpByArea.get(area) ?? 0) + (l.xpAwarded ?? 0));
  }
  const total = [...xpByArea.values()].reduce((a, v) => a + v, 0);
  const rows: AreaXpRow[] = [];
  for (const [area, xp] of xpByArea) {
    if (xp <= 0) continue;
    const label =
      area === UNCATEGORIZED ? "Uncategorized" : areaLabel(area as LifeArea);
    const color =
      area === UNCATEGORIZED ? "var(--ink-3)" : areaColor(area as LifeArea);
    rows.push({
      area,
      label,
      color,
      xp,
      pctOfMonth: total > 0 ? Math.round((xp / total) * 100) : 0,
    });
  }
  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}

function minScanDate(habits: Habit[], logs: Log[], asOf: Date): string {
  let minT = asOf.getTime() - SCAN_CAP_DAYS * MS_DAY;
  for (const h of activeHabits(habits)) {
    minT = Math.min(minT, h.createdAt);
  }
  for (const l of logs) {
    if (l.deletedAt) continue;
    const t = parseLocalISO(l.date).getTime();
    minT = Math.min(minT, t);
  }
  return toLocalISO(new Date(minT));
}

/** Calendar days where due>0 and completion meets streak threshold (matches engine intent). */
export function buildCalendarActiveDates(
  habits: Habit[],
  logs: Log[],
  asOf: Date = new Date()
): Set<string> {
  const end = toLocalISO(asOf);
  const start = minScanDate(habits, logs, asOf);
  const active = new Set<string>();
  let cursor = parseLocalISO(start);
  const endD = parseLocalISO(end);
  while (cursor <= endD) {
    const ds = toLocalISO(cursor);
    const { due, done } = dayDueDoneCounts(habits, logs, ds);
    if (due > 0 && done / due >= STREAK_THRESHOLD) active.add(ds);
    cursor = addDays(cursor, 1);
  }
  return active;
}

export function longestConsecutiveStreakDays(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0;
  const sorted = [...activeDates].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseLocalISO(sorted[i - 1]).getTime();
    const next = parseLocalISO(sorted[i]).getTime();
    if (next - prev === MS_DAY) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

export function streakInsights(
  habits: Habit[],
  logs: Log[],
  asOf: Date = new Date()
): { currentStreak: number; bestStreak: number } {
  const activeDates = buildCalendarActiveDates(habits, logs, asOf);
  const todayISO = toLocalISO(asOf);
  const currentStreak = computeStreak(activeDates, todayISO);
  const bestStreak = longestConsecutiveStreakDays(activeDates);
  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
  };
}
