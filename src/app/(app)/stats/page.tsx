"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { addWeeks, format, startOfWeek } from "date-fns";
import { db } from "@/lib/db/dexie";
import { fmtMinutes } from "@/lib/utils";
import {
  compoundMultiplier,
  consecutiveWeeksHit,
  weekMinutes,
} from "@/lib/engine";

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--ink-1)",
};

export default function StatsPage() {
  const goals = useLiveQuery(
    () => db().goals.filter((g) => !g.archived && !g.deletedAt).toArray(),
    []
  );
  const sessions = useLiveQuery(
    () => db().sessions.filter((s) => !s.deletedAt).toArray(),
    []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const pieData = useMemo(() => {
    if (!goals || !sessions) return [];
    return goals
      .map((g) => {
        const m = weekMinutes(sessions, g.id, weekStart);
        return { name: g.title, value: m, color: g.color };
      })
      .filter((d) => d.value > 0);
  }, [goals, sessions, weekStart]);

  const compoundData = useMemo(() => {
    if (!goals || !sessions) return [];
    return Array.from({ length: 12 }).map((_, i) => {
      const ws = addWeeks(weekStart, -11 + i);
      const muls = goals.map((g) =>
        compoundMultiplier(consecutiveWeeksHit(sessions, g, ws))
      );
      const avg = muls.length
        ? muls.reduce((a, b) => a + b, 0) / muls.length
        : 1;
      return { week: format(ws, "MMM d"), mul: Number(avg.toFixed(2)) };
    });
  }, [goals, sessions, weekStart]);

  const heatmap = useMemo(() => {
    if (!sessions) return { weeks: [] as string[][], totals: new Map<string, number>() };
    const totals = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      totals.set(key, (totals.get(key) ?? 0) + s.minutes);
    }
    const weeks: string[][] = [];
    let cur = startOfWeek(new Date(), { weekStartsOn: 1 });
    cur = new Date(cur.getTime() - 11 * 7 * 24 * 3600 * 1000);
    for (let w = 0; w < 12; w++) {
      const row: string[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(cur.getTime() + (w * 7 + d) * 24 * 3600 * 1000);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        row.push(key);
      }
      weeks.push(row);
    }
    return { weeks, totals };
  }, [sessions]);

  const totalThisWeek = pieData.reduce((a, d) => a + d.value, 0);
  const totalLogs = logs?.length ?? 0;

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div>
        <div className="os-label">Telemetry</div>
        <h1 className="serif text-3xl text-[var(--ink-1)]">Stats</h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="This week" value={fmtMinutes(totalThisWeek)} />
        <Stat label="Sessions" value={String(sessions?.length ?? 0)} />
        <Stat label="Logs" value={String(totalLogs)} />
      </div>

      <section>
        <SectionTitle>Where your week went</SectionTitle>
        {pieData.length === 0 ? (
          <Empty>No focus sessions yet this week.</Empty>
        ) : (
          <div className="os-block p-4">
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="var(--bg)"
                    strokeWidth={2}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmtMinutes(Number(v))}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: d.color }}
                  />
                  <span className="text-[var(--ink-2)] truncate">{d.name}</span>
                  <span className="font-mono text-[var(--ink-3)] ml-auto">
                    {fmtMinutes(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Compounding curve</SectionTitle>
        <div className="os-block p-3 h-44">
          <ResponsiveContainer>
            <LineChart data={compoundData}>
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--surface-2)" }} />
              <Line
                type="monotone"
                dataKey="mul"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-[var(--ink-3)] mt-2 font-mono">
          avg xp multiplier across goals · hit weekly targets in a row to push
          it up
        </p>
      </section>

      <section>
        <SectionTitle>Consistency · last 12 weeks</SectionTitle>
        <div className="os-block p-4">
          <div className="flex flex-col gap-1">
            {heatmap.weeks.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((key) => {
                  const m = heatmap.totals.get(key) ?? 0;
                  const intensity = m === 0 ? 0 : Math.min(1, m / 120);
                  return (
                    <div
                      key={key}
                      title={`${key}: ${fmtMinutes(m)}`}
                      className="h-4 flex-1 rounded-[2px]"
                      style={{
                        background:
                          intensity === 0
                            ? "var(--surface-2)"
                            : `rgba(201,169,97,${0.18 + intensity * 0.7})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="os-block p-3 text-center">
      <div className="text-base font-mono text-[var(--ink-1)]">{value}</div>
      <div className="os-label mt-0.5">{label}</div>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="os-label mb-2">{children}</h2>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="os-block p-6 text-center text-sm text-[var(--ink-3)]">
      {children}
    </div>
  );
}
