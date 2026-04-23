"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import * as Icons from "lucide-react";
import { getRepo } from "@/lib/repo";
import { Progress } from "@/components/ui/Progress";
import { levelFromXp } from "@/lib/engine";
import { BADGES } from "@/lib/engine/badges";
import { fmtMinutes } from "@/lib/utils";
import type { Achievement, Goal, UserProfile } from "@/types";

export default function PublicProfilePage() {
  const params = useParams();
  const handle = String(params.handle).toLowerCase();
  const [user, setUser] = useState<UserProfile | undefined>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    (async () => {
      const repo = await getRepo();
      const u = await repo.getUser();
      if (!u || u.handle !== handle) {
        setUser(undefined);
        return;
      }
      setUser(u);
      const g = await repo.listGoals();
      setGoals(g);
      const a = await repo.listAchievements();
      setAchievements(a);
      const s = await repo.listSessions();
      setTotalMinutes(s.reduce((acc, x) => acc + x.minutes, 0));
    })();
  }, [handle]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md min-h-[100dvh] px-5 pt-20 text-center text-[var(--ink-3)]">
        @{handle} hasn&apos;t shared a profile yet.
      </div>
    );
  }

  if (!user.isPublic) {
    return (
      <div className="mx-auto max-w-md min-h-[100dvh] px-5 pt-20 text-center text-[var(--ink-3)]">
        @{user.handle}&apos;s profile is private.
      </div>
    );
  }

  const { level, xpInLevel, xpForNext, progress } = levelFromXp(user.totalXp);
  const have = new Set(achievements.map((a) => a.key));
  const earned = BADGES.filter((b) => have.has(b.key));

  return (
    <div className="mx-auto max-w-md min-h-[100dvh] px-5 pt-10 pb-10 space-y-6">
      <div className="os-block-strong p-6 text-center">
        <div className="h-16 w-16 mx-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center text-2xl serif text-[var(--ink-1)] mb-3">
          {user.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="serif text-2xl text-[var(--ink-1)]">{user.displayName}</div>
        <div className="text-xs text-[var(--ink-3)] font-mono">@{user.handle}</div>
        <div className="text-xs text-[var(--ink-3)] capitalize mt-1 font-mono">
          {user.className} · LV {level}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs mb-1.5">
            <span className="text-[var(--ink-3)] font-mono">level {level}</span>
            <span className="text-[var(--ink-3)] font-mono tabular-nums">
              {xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} xp
            </span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Stat label="Streak" value={`${user.streakDays}d`} />
          <Stat label="Focus" value={fmtMinutes(totalMinutes)} />
          <Stat label="Badges" value={`${earned.length}`} />
        </div>
      </div>

      <section>
        <h2 className="os-label mb-2">Headline goals</h2>
        <div className="space-y-1.5">
          {goals.slice(0, 4).map((g) => (
            <div key={g.id} className="os-block px-3 py-2.5 flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: g.color }}
              />
              <span className="text-sm flex-1 truncate text-[var(--ink-1)]">{g.title}</span>
              <span className="text-xs text-[var(--ink-3)] font-mono tabular-nums">
                {fmtMinutes(g.weeklyTargetMinutes)}/wk
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="os-label mb-2">Badges</h2>
        <div className="grid grid-cols-4 gap-2">
          {earned.map((b) => {
            const Icon = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[
              b.icon
            ];
            return (
              <div
                key={b.key}
                className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3 text-center"
                title={b.description}
              >
                <div className="h-10 w-10 mx-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center mb-1 text-[var(--accent)]">
                  {Icon ? <Icon size={18} /> : null}
                </div>
                <div className="text-[10px] font-medium truncate text-[var(--ink-1)]">{b.title}</div>
              </div>
            );
          })}
          {earned.length === 0 && (
            <div className="col-span-4 os-block p-4 text-center text-sm text-[var(--ink-3)]">
              No badges yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] py-2">
      <div className="text-base font-semibold text-[var(--ink-1)] tabular-nums">{value}</div>
      <div className="os-label">{label}</div>
    </div>
  );
}
