"use client";

import { useMemo, type CSSProperties } from "react";
import { useUser } from "@/store/useUser";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { addDays, addWeeks, startOfWeek } from "date-fns";
import { TrendingUp, TrendingDown, Minus, ArrowLeft } from "lucide-react";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { db } from "@/lib/db/dexie";
import { cn } from "@/lib/utils";
import type { BodyLog, Habit, LifeArea } from "@/types";
import {
  areaBreakdownThisMonth,
  averageWeeklyCompletion,
  bestTimeOfDayBucket,
  heatmap90Days,
  heatmapGridCells,
  streakInsights,
  type HeatmapDay,
  weekCompletionPct,
  xpThisCalendarMonth,
} from "@/lib/stats/insights";

const AREA_META: Record<LifeArea, { label: string; color: string }> = {
  career:        { label: "Career",        color: "#C9A96E" },
  health:        { label: "Health",        color: "#7AA98A" },
  mind:          { label: "Mind",          color: "#A96EC9" },
  wealth:        { label: "Wealth",        color: "#6E9BC9" },
  craft:         { label: "Craft",         color: "#D97757" },
  relationships: { label: "Relations",     color: "#C96E9B" },
  lifestyle:     { label: "Lifestyle",     color: "#6EC9C9" },
};

function areaScores(
  habits: Habit[],
  logs: import("@/types").Log[],
  weekStart: Date,
  prevWeekStart: Date,
  asOf: Date
): Array<{ area: LifeArea; label: string; color: string; thisWeek: number; lastWeek: number; delta: number }> {
  return (Object.keys(AREA_META) as LifeArea[]).map(area => {
    const aHabits = habits.filter(h => (h as Habit & { area?: LifeArea }).area === area);
    const tw = weekCompletionPct(aHabits, logs, weekStart, asOf);
    const lw = weekCompletionPct(aHabits, logs, prevWeekStart, asOf);
    return {
      area,
      ...AREA_META[area],
      thisWeek: tw,
      lastWeek: lw,
      delta: tw - lw,
    };
  }).filter(r => r.thisWeek > 0 || r.lastWeek > 0);
}

const tooltipStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ink-1)",
};

const ROW_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function heatCellStyle(level: number): CSSProperties {
  if (level < 0) {
    return {
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
    };
  }
  const opacity = 0.2 + level * 0.16;
  return {
    background: "var(--accent)",
    opacity,
    border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
  };
}

function heatCellTitle(cell: HeatmapDay | null): string {
  if (!cell) return "";
  if (cell.level < 0) return `${cell.date} — no habits due`;
  const pct = cell.ratio != null ? Math.round(cell.ratio * 100) : 0;
  return `${cell.date} — ${cell.done}/${cell.due} done (${pct}%)`;
}

export default function StatsPage() {
  const user = useUser((s) => s.user);
  const habits = useLiveQuery(
    () => db().habits.filter(h => !h.archived && !h.deletedAt).toArray(), []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);
  const bodyLogs = useLiveQuery(
    () => {
      if (!user?.userId) return Promise.resolve([] as BodyLog[]);
      return db()
        .bodyLogs.where("userId")
        .equals(user.userId)
        .toArray()
        .then((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
    },
    [user?.userId]
  );

  const today       = new Date();
  const weekStart   = startOfWeek(today, { weekStartsOn: 1 });
  const prevWeek    = addWeeks(weekStart, -1);

  // Overall weekly score last 8 weeks
  const weeklyScores = useMemo(() => {
    if (!habits || !logs) return [];
    return Array.from({ length: 8 }).map((_, i) => {
      const ws = addWeeks(weekStart, -7 + i);
      const score = weekCompletionPct(habits, logs, ws, today);
      const label = ws.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { label, score };
    });
  }, [habits, logs, weekStart, today]);

  // Per-area scores this week vs last
  const areas = useMemo(() => {
    if (!habits || !logs) return [];
    return areaScores(habits, logs, weekStart, prevWeek, today);
  }, [habits, logs, weekStart, prevWeek, today]);

  const heatmapCells = useMemo(() => {
    if (!habits || !logs) return [];
    return heatmapGridCells(heatmap90Days(habits, logs, today));
  }, [habits, logs, today]);

  const streaks = useMemo(() => {
    if (!habits || !logs) return { currentStreak: 0, bestStreak: 0 };
    return streakInsights(habits, logs, today);
  }, [habits, logs, today]);

  const weeklyAvg4 = useMemo(() => {
    if (!habits || !logs) return 0;
    return averageWeeklyCompletion(habits, logs, today, 4);
  }, [habits, logs, today]);

  const xpMonth = useMemo(() => {
    if (!logs) return 0;
    return xpThisCalendarMonth(logs, today);
  }, [logs, today]);

  const timeOfDay = useMemo(() => {
    if (!logs) return { primary: null as ReturnType<typeof bestTimeOfDayBucket>["primary"], secondary: null };
    return bestTimeOfDayBucket(logs, today, 90);
  }, [logs, today]);

  const areaMonthXp = useMemo(() => {
    if (!habits || !logs) return [];
    return areaBreakdownThisMonth(
      habits,
      logs,
      (a) => AREA_META[a].label,
      (a) => AREA_META[a].color,
      today
    );
  }, [habits, logs, today]);

  // Radar data
  const radarData = useMemo(() =>
    areas.map(a => ({ subject: a.label, score: a.thisWeek, full: 100 })),
    [areas]
  );

  // Overall this week
  const overallThis = useMemo(() => {
    if (!habits || !logs) return 0;
    return weekCompletionPct(habits, logs, weekStart, today);
  }, [habits, logs, weekStart, today]);
  const overallLast = useMemo(() => {
    if (!habits || !logs) return 0;
    return weekCompletionPct(habits, logs, prevWeek, today);
  }, [habits, logs, prevWeek, today]);
  const overallDelta = overallThis - overallLast;

  if (habits === undefined || logs === undefined) return <SkeletonPage cards={6} />;

  return (
    <div className="px-5 pt-6 pb-10 space-y-7">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/profile" className="rounded-md p-1.5 -ml-1.5 hover:bg-[var(--surface)] text-[var(--ink-3)]">
            <ArrowLeft size={16} />
          </Link>
          <div className="os-label">Performance</div>
        </div>
        <h1 className="serif text-3xl text-[var(--ink-1)]">Stats</h1>
      </motion.div>

      {/* 90-day heatmap + KPIs + monthly area XP */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="space-y-4"
      >
        <div>
          <div className="os-label mb-2">Consistency · 90 days</div>
          <div className="os-block p-3">
            <div className="flex gap-2">
              <div className="flex flex-col gap-[3px] shrink-0 w-[18px] text-[8px] font-mono text-[var(--ink-3)] leading-none pt-px">
                {ROW_LABELS.map((lb) => (
                  <div key={lb} className="h-[10px] flex items-center justify-end pr-0.5">
                    {lb}
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto min-w-0 flex-1">
                <div className="flex gap-[3px] min-w-max">
                  {Array.from({ length: Math.max(1, Math.ceil(heatmapCells.length / 7)) }).map((_, col) => (
                    <div key={col} className="flex flex-col gap-[3px] shrink-0">
                      {Array.from({ length: 7 }).map((_, row) => {
                        const idx = col * 7 + row;
                        const cell = heatmapCells[idx] ?? null;
                        const lvl = cell?.level ?? -1;
                        return (
                          <div
                            key={row}
                            title={heatCellTitle(cell)}
                            className="w-[10px] h-[10px] rounded-[2px] shrink-0 box-border"
                            style={heatCellStyle(lvl)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[9px] font-mono text-[var(--ink-3)] mt-2 flex justify-between">
              <span>Older</span>
              <span>Newer</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="os-block p-3">
            <div className="os-label mb-1">Current streak</div>
            <div className="text-2xl font-mono text-[var(--ink-1)]">{streaks.currentStreak}d</div>
            <div className="text-[10px] text-[var(--ink-3)] mt-1">Days with ≥50% of due habits done</div>
          </div>
          <div className="os-block p-3">
            <div className="os-label mb-1">Best streak</div>
            <div className="text-2xl font-mono text-[var(--accent)]">{streaks.bestStreak}d</div>
          </div>
          <div className="os-block p-3">
            <div className="os-label mb-1">Weekly completion</div>
            <div className="text-2xl font-mono text-[var(--ink-1)]">{weeklyAvg4}%</div>
            <div className="text-[10px] text-[var(--ink-3)] mt-1">Avg last 4 ISO weeks</div>
          </div>
          <div className="os-block p-3">
            <div className="os-label mb-1">XP this month</div>
            <div className="text-2xl font-mono text-[var(--accent)]">{xpMonth}</div>
          </div>
        </div>

        <div className="os-block p-3">
          <div className="os-label mb-1">Logging rhythm</div>
          {timeOfDay.primary ? (
            <p className="text-sm text-[var(--ink-2)]">
              Most activity:{" "}
              <span className="text-[var(--ink-1)] font-medium">{timeOfDay.primary.label}</span>
              <span className="text-[var(--ink-3)]"> ({timeOfDay.primary.range})</span>
              <span className="font-mono text-[11px] text-[var(--ink-3)]">
                {" "}
                · {timeOfDay.primary.count} logs · {timeOfDay.primary.xp} XP
              </span>
            </p>
          ) : (
            <p className="text-sm text-[var(--ink-3)]">Not enough logs in the last 90 days.</p>
          )}
          {timeOfDay.secondary ? (
            <p className="text-[11px] text-[var(--ink-3)] mt-1">
              Runner-up: {timeOfDay.secondary.label} ({timeOfDay.secondary.count} logs)
            </p>
          ) : null}
        </div>

        <div>
          <div className="os-label mb-2">By life area · XP this month</div>
          {areaMonthXp.length === 0 ? (
            <div className="os-block p-4 text-sm text-[var(--ink-3)]">No XP logged this month yet.</div>
          ) : (
            <div className="os-block p-3 space-y-2">
              {areaMonthXp.map((row) => (
                <div key={String(row.area)}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: row.color }}
                      />
                      <span className="font-mono text-[var(--ink-2)] truncate">{row.label}</span>
                    </span>
                    <span className="font-mono text-[var(--ink-1)] shrink-0 pl-2">
                      {row.xp} XP · {row.pctOfMonth}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${row.pctOfMonth}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* overall score this week */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="os-block-strong p-5 text-center">
          <div className="os-label mb-1">Overall this week</div>
          <div className="serif text-7xl text-[var(--accent)]">{overallThis}</div>
          <div className={cn(
            "mt-2 flex items-center justify-center gap-1.5 text-sm font-medium",
            overallDelta > 0 ? "text-[var(--success)]" : overallDelta < 0 ? "text-[var(--danger)]" : "text-[var(--ink-3)]"
          )}>
            {overallDelta > 0 ? <TrendingUp size={14} /> : overallDelta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            {overallDelta > 0 ? "+" : ""}{overallDelta}% vs last week
          </div>
        </div>
      </motion.div>

      {/* area improvement grid */}
      {areas.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="os-label mb-2">Areas — this week vs last</div>
          <div className="grid grid-cols-2 gap-2">
            {areas.map((a, idx) => (
              <motion.div
                key={a.area}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + idx * 0.04 }}
                className="os-block p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                    <span className="text-[11px] font-mono text-[var(--ink-2)]">{a.label}</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono flex items-center gap-0.5",
                    a.delta > 0 ? "text-[var(--success)]" : a.delta < 0 ? "text-[var(--danger)]" : "text-[var(--ink-3)]"
                  )}>
                    {a.delta > 0 ? <TrendingUp size={10} /> : a.delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {a.delta > 0 ? "+" : ""}{a.delta}%
                  </span>
                </div>
                <div className="text-xl font-mono text-[var(--ink-1)] mb-1">{a.thisWeek}%</div>
                <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: a.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${a.thisWeek}%` }}
                    transition={{ delay: 0.2 + idx * 0.04, duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="text-[10px] text-[var(--ink-3)] font-mono mt-1">
                  last: {a.lastWeek}%
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* radar chart */}
      {radarData.length > 2 && (
        <div>
          <div className="os-label mb-2">Balance radar</div>
          <div className="os-block p-3 h-56">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--ink-3)", fontSize: 10 }} />
                <Radar name="Score" dataKey="score" stroke="var(--accent)"
                  fill="var(--accent)" fillOpacity={0.18} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "score"]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 8-week trend */}
      {weeklyScores.some(w => w.score > 0) && (
        <div>
          <div className="os-label mb-2">8-week consistency</div>
          <div className="os-block p-3 h-44">
            <ResponsiveContainer>
              <LineChart data={weeklyScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <Line type="monotone" dataKey="score" stroke="var(--accent)"
                  strokeWidth={2} dot={{ fill: "var(--accent)", r: 3 }} activeDot={{ r: 5 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "score"]} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* body tracker quick link */}
      {bodyLogs && bodyLogs.length > 0 && (
        <div>
          <div className="os-label mb-2">Body</div>
          <Link href="/body">
            <div className="os-block px-4 py-3 flex items-center justify-between hover:border-[var(--border-strong)] transition">
              <div>
                <div className="text-sm font-medium text-[var(--ink-1)]">
                  {bodyLogs[0].weight ? `${bodyLogs[0].weight} kg` : "No weight"} — latest
                </div>
                <div className="text-[11px] font-mono text-[var(--ink-3)]">{bodyLogs.length} entries logged</div>
              </div>
              <span className="text-[var(--ink-3)]">→</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
