"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import * as Icons from "lucide-react";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { BADGES, evaluateBadges } from "@/lib/engine/badges";
import { levelFromXp } from "@/lib/engine";
import { nanoid } from "nanoid";
import { LOCAL_USER_ID, cn } from "@/lib/utils";
import { Activity, CalendarCheck2, Settings, Share2, Users } from "lucide-react";

export default function ProfilePage() {
  const { user, load } = useUser();
  useEffect(() => void load(), [load]);

  const goals = useLiveQuery(
    () => db().habits.filter((g) => !g.archived && !g.deletedAt).toArray(),
    []
  );
  const sessions = useLiveQuery(
    () => db().sessions.filter((s) => !s.deletedAt).toArray(),
    []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);
  const unlocked = useLiveQuery(() => db().achievements.toArray(), []);

  useEffect(() => {
    if (!user || !goals || !sessions || !logs || !unlocked) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newOnes = evaluateBadges({ user, goals: goals as any, sessions, logs }, unlocked);
    if (newOnes.length) {
      void Promise.all(
        newOnes.map((b) =>
          db().achievements.put({
            id: nanoid(),
            userId: LOCAL_USER_ID,
            key: b.key,
            unlockedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        )
      );
    }
  }, [user, goals, sessions, logs, unlocked]);

  if (!user) {
    return (
      <div className="px-5 pt-6 pb-10 space-y-4">
        <div className="skeleton h-9 w-20 rounded-xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
      </div>
    );
  }
  const { level, name: levelTitle, xpInLevel, xpForNext, progress } = levelFromXp(user.totalXp);
  const have = new Set((unlocked ?? []).map((a) => a.key));

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="os-label">Account</div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">You</h1>
        </div>
        <Link
          href="/settings"
          className="rounded-md p-2 hover:bg-[var(--surface)]"
        >
          <Settings size={18} />
        </Link>
      </div>

      <div className="os-block-strong p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/40 flex items-center justify-center serif text-2xl text-[var(--accent)]">
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[var(--ink-1)] truncate">
              {user.displayName}
            </div>
            <div className="text-[11px] font-mono text-[var(--ink-3)]">
              @{user.handle} · LV {level} {levelTitle}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[11px] os-label mb-1.5">
            <span>LV {level} · {levelTitle}</span>
            <span className="font-mono text-[var(--ink-2)] tracking-normal normal-case">
              {xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/review">
          <Button variant="secondary" className="w-full">
            <CalendarCheck2 size={14} /> Review
          </Button>
        </Link>
        <Link href="/body">
          <Button variant="secondary" className="w-full">
            <Activity size={14} /> Body
          </Button>
        </Link>
        <Link href="/stats">
          <Button variant="secondary" className="w-full">
            <Share2 size={14} /> Stats
          </Button>
        </Link>
        <Link href="/friends">
          <Button variant="secondary" className="w-full">
            <Users size={14} /> Friends
          </Button>
        </Link>
      </div>

      <div>
        <div className="os-label mb-2">
          Badges · {have.size} / {BADGES.length}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const Icon = (Icons as unknown as Record<string, React.FC<{ size?: number }>>)[b.icon];
            const earned = have.has(b.key);
            return (
              <div
                key={b.key}
                className={cn(
                  "os-block p-3 text-center transition",
                  earned ? "border-[var(--accent)]/40" : "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 mx-auto rounded-md flex items-center justify-center mb-1.5 border",
                    earned
                      ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--ink-3)]"
                  )}
                >
                  {Icon ? <Icon size={16} /> : null}
                </div>
                <div className="text-[11px] font-medium text-[var(--ink-1)] truncate">
                  {b.title}
                </div>
                <div className="text-[10px] text-[var(--ink-3)] line-clamp-2 leading-tight mt-0.5">
                  {b.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Link href="/review">
        <Button variant="secondary" className="w-full">
          Open weekly review
        </Button>
      </Link>
    </div>
  );
}
