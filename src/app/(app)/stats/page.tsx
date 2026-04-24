"use client";

import { useMemo } from "react";
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
import { db } from "@/lib/db/dexie";
import { habitDoneToday, isHabitDueToday } from "@/lib/engine";
import { cn } from "@/lib/utils";
import type { Habit, LifeArea } from "@/types";

const AREA_META: Record<LifeArea, { label: string; color: string }> = {
  career:        { label: "Career",        color: "#C9A96E" },
  health:        { label: "Health",        color: "#7AA98A" },
  mind:          { label: "Mind",          color: "#A96EC9" },
  wealth:        { label: "Wealth",        color: "#6E9BC9" },
  craft:         { label: "Craft",         color: "#D97757" },
  relationships: { label: "Relations",     color: "#C96E9B" },
  lifestyle:     { label: "Lifestyle",     color: "#6EC9C9" },
};

// Compute completion ratio for a single week
function weekScore(habits: Habit[], logs: import("@/types").Log[], weekStart: Date) {
  let due = 0, done = 0;
  for (const h of habits) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (d > new Date()) break;
      if (!isHabitDueToday(h, d)) continue;
      due++;
      const ds = d.toISOString().slice(0, 10);
      if (habitDoneToday(h, logs, ds).done) done++;
    }
  }
  return due > 0 ? Math.round((done / due) * 100) : 0;
}

function areaScores(
  habits: Habit[],
  logs: import("@/types").Log[],
  weekStart: Date,
  prevWeekStart: Date
): Array<{ area: LifeArea; label: string; color: string; thisWeek: number; lastWeek: number; delta: number }> {
  return (Object.keys(AREA_META) as LifeArea[]).map(area => {
    const aHabits = habits.filter(h => (h as Habit & { area?: LifeArea }).area === area);
    const tw = weekScore(aHabits, logs, weekStart);
    const lw = weekScore(aHabits, logs, prevWeekStart);
    return {
      area,
      ...AREA_META[area],
      thisWeek: tw,
      lastWeek: lw,
      delta: tw - lw,
    };
  }).filter(r => r.thisWeek > 0 || r.lastWeek > 0);
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ink-1)",
};

export default function StatsPage() {
  const habits = useLiveQuery(
    () => db().habits.filter(h => !h.archived && !h.deletedAt).toArray(), []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);
  const bodyLogs = useLiveQuery(
    () => db().bodyLogs.where("userId").equals("local-user")
      .reverse().sortBy("date"),
    []
  );

  const today       = new Date();
  const weekStart   = startOfWeek(today, { weekStartsOn: 1 });
  const prevWeek    = addWeeks(weekStart, -1);

  // Overall weekly score last 8 weeks
  const weeklyScores = useMemo(() => {
    if (!habits || !logs) return [];
    return Array.from({ length: 8 }).map((_, i) => {
      const ws = addWeeks(weekStart, -7 + i);
      const score = weekScore(habits, logs, ws);
      const label = ws.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return { label, score };
    });
  }, [habits, logs, weekStart]);

  // Per-area scores this week vs last
  const areas = useMemo(() => {
    if (!habits || !logs) return [];
    return areaScores(habits, logs, weekStart, prevWeek);
  }, [habits, logs, weekStart, prevWeek]);

  // Radar data
  const radarData = useMemo(() =>
    areas.map(a => ({ subject: a.label, score: a.thisWeek, full: 100 })),
    [areas]
  );

  // Overall this week
  const overallThis = useMemo(() => {
    if (!habits || !logs) return 0;
    return weekScore(habits, logs, weekStart);
  }, [habits, logs, weekStart]);
  const overallLast = useMemo(() => {
    if (!habits || !logs) return 0;
    return weekScore(habits, logs, prevWeek);
  }, [habits, logs, prevWeek]);
  const overallDelta = overallThis - overallLast;

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
