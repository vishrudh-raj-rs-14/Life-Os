"use client";

import Link from "next/link";
import { Flame, Snowflake, Sparkles } from "lucide-react";
import type { UserProfile } from "@/types";
import { levelFromXp } from "@/lib/engine";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function HeaderBar({
  user,
  dailyEarned,
  dailyCap,
  dailyBonusActive,
}: {
  user: UserProfile;
  /** XP from today's logs for habits due today */
  dailyEarned: number;
  /** Max XP if all due habits fully completed today */
  dailyCap: number;
  /** Today's daily-bar completion bonus is active */
  dailyBonusActive?: boolean;
}) {
  const { level, name: levelTitle, xpInLevel, xpForNext, progress } = levelFromXp(user.totalXp);
  const today = new Date();
  const weekday = WD[today.getDay()];
  const month = MO[today.getMonth()];
  const day = today.getDate();
  const year = today.getFullYear();

  const dailyProgress = dailyCap > 0 ? Math.min(1, dailyEarned / dailyCap) : 0;

  return (
    <div className="px-5 pt-6 pb-2">
      {/* OS bar */}
      <div className="flex items-center justify-between text-[11px] os-label">
        <span>Life&nbsp;OS · @{user.handle}</span>
        <span>v0.1</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] os-label">Today</div>
          <h1 className="serif text-[28px] leading-none mt-1 text-[var(--ink-1)] truncate">
            {weekday}, {month} {day}
          </h1>
          <div className="text-[11px] text-[var(--ink-3)] mt-1 font-mono">
            {year} · {user.displayName}
          </div>
        </div>

        <Link
          href="/profile"
          className="flex items-center gap-1.5 shrink-0 text-[var(--ink-2)]"
          aria-label="profile"
        >
          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
            <Flame size={12} className="text-[var(--warn)]" />
            <span className="font-mono text-xs">{user.streakDays}d</span>
          </span>
          {user.streakFreezes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
              <Snowflake size={11} className="text-[var(--info)]" />
              <span className="font-mono text-xs">{user.streakFreezes}</span>
            </span>
          )}
        </Link>
      </div>

      {/* level / xp bar */}
      <div className="mt-4 os-block px-3 py-2.5">
        <div className="flex items-center justify-between text-[11px] os-label mb-1.5">
          <span>
            LV {level} · {levelTitle}
          </span>
          <span className="font-mono text-[var(--ink-2)] tracking-normal normal-case">
            {xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP
          </span>
        </div>
        <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${Math.min(1, progress) * 100}%` }}
          />
        </div>
      </div>

      {/* daily XP toward today's due habits */}
      <div className="mt-2.5 os-block px-3 py-2.5 border-[var(--border)]">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="os-label">Today&apos;s XP</span>
          <span className="font-mono text-[var(--ink-2)] tabular-nums">
            {Math.round(dailyEarned).toLocaleString()}
            {dailyCap > 0 ? (
              <> / {Math.round(dailyCap).toLocaleString()}</>
            ) : (
              <span className="text-[var(--ink-3)]"> · nothing due</span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${dailyProgress * 100}%`,
              background: dailyBonusActive
                ? "linear-gradient(90deg, var(--success), var(--accent))"
                : "var(--info)",
            }}
          />
        </div>
        {dailyBonusActive && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-[var(--success)]">
            <Sparkles size={11} />
            Daily bonus applied — stays while today&apos;s bar stays full
          </div>
        )}
        {dailyCap > 0 && !dailyBonusActive && dailyProgress >= 0.99 && (
          <div className="mt-1 text-[10px] font-mono text-[var(--warn)]">
            Hit 100% to earn bonus level XP (removed if you drop below)
          </div>
        )}
      </div>
    </div>
  );
}
