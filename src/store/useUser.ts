"use client";

import { create } from "zustand";
import type { Habit, Log, UserProfile } from "@/types";
import { getRepo } from "@/lib/repo";
import {
  dailyBarBonusAmount,
  dailyXpEarnedFromLogs,
  levelFromXp,
  maxDailyXpForHabit,
} from "@/lib/engine";
import { todayISO } from "@/lib/utils";

let profileSyncTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleProfileSync(user: UserProfile) {
  if (profileSyncTimer) clearTimeout(profileSyncTimer);
  profileSyncTimer = setTimeout(() => {
    profileSyncTimer = undefined;
    void getRepo()
      .then((repo) => repo.upsertUser(user))
      .catch(() => {});
  }, 700);
}

interface UserState {
  user?: UserProfile;
  loading: boolean;
  load: () => Promise<void>;
  setUser: (u: UserProfile) => Promise<void>;
  awardXp: (amount: number) => Promise<{ leveledUp: boolean; newLevel: number }>;
  bumpStreak: () => Promise<void>;
  /** Keeps reversible daily-bar bonus in sync with logs (anti-farm). */
  syncDailyXpBonus: (
    today: string,
    dueHabits: Habit[],
    todayLogs: Log[]
  ) => Promise<{
    delta: number;
    desiredBonus: number;
    earned: number;
    cap: number;
    leveledUp: boolean;
    newLevel: number;
  }>;
}

export const useUser = create<UserState>((set, get) => ({
  user: undefined,
  loading: true,
  async load() {
    const repo = await getRepo();
    const u = await repo.getUser();
    set({ user: u, loading: false });
  },
  async setUser(u) {
    const repo = await getRepo();
    set({ user: u });
    await repo.upsertUser(u);
  },
  async awardXp(amount) {
    const repo = get().user ? undefined : await getRepo();
    const u = get().user ?? (await repo!.getUser())!;
    const before = levelFromXp(u.totalXp).level;
    const totalXp = u.totalXp + amount;
    const after = levelFromXp(totalXp).level;
    const updated: UserProfile = {
      ...u,
      totalXp,
      level: after,
      updatedAt: Date.now(),
    };
    set({ user: updated });
    scheduleProfileSync(updated);
    return { leveledUp: after > before, newLevel: after };
  },
  async bumpStreak() {
    const repo = get().user ? undefined : await getRepo();
    const u = get().user ?? (await repo!.getUser())!;
    const today = todayISO();
    if (u.lastActiveDate === today) return;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    const newStreak =
      u.lastActiveDate === yestStr ? u.streakDays + 1 : 1;
    const updated: UserProfile = {
      ...u,
      streakDays: newStreak,
      lastActiveDate: today,
      updatedAt: Date.now(),
    };
    set({ user: updated });
    scheduleProfileSync(updated);
    // ignore returned value to keep type loose; caller can re-read
    void get();
  },
  async syncDailyXpBonus(today, dueHabits, todayLogs) {
    const repo = get().user ? undefined : await getRepo();
    let u = get().user ?? (await repo!.getUser());
    if (!u) {
      return {
        delta: 0,
        desiredBonus: 0,
        earned: 0,
        cap: 0,
        leveledUp: false,
        newLevel: 1,
      };
    }

    const dueIds = new Set(dueHabits.map((h) => h.id));
    const cap = dueHabits.reduce((a, h) => a + maxDailyXpForHabit(h), 0);
    const earned = dailyXpEarnedFromLogs(todayLogs, today, dueIds);

    // Clear stale bookkeeping from a previous calendar day (bonus stays in totalXp)
    if (u.dailyBonusDate && u.dailyBonusDate !== today) {
      u = {
        ...u,
        dailyBonusDate: undefined,
        dailyBonusXp: undefined,
        updatedAt: Date.now(),
      };
      set({ user: u });
      scheduleProfileSync(u);
    }

    const tracked =
      u.dailyBonusDate === today && typeof u.dailyBonusXp === "number"
        ? u.dailyBonusXp
        : 0;
    const desiredBonus =
      cap > 0 && earned >= cap ? dailyBarBonusAmount(cap) : 0;
    const delta = desiredBonus - tracked;

    if (delta === 0) {
      return {
        delta: 0,
        desiredBonus,
        earned,
        cap,
        leveledUp: false,
        newLevel: levelFromXp(u.totalXp).level,
      };
    }

    const before = levelFromXp(u.totalXp).level;
    const totalXp = u.totalXp + delta;
    const after = levelFromXp(totalXp).level;
    const leveledUp = after > before;
    const updated: UserProfile = {
      ...u,
      totalXp,
      level: after,
      dailyBonusDate: desiredBonus > 0 ? today : undefined,
      dailyBonusXp: desiredBonus > 0 ? desiredBonus : undefined,
      updatedAt: Date.now(),
    };
    set({ user: updated });
    scheduleProfileSync(updated);
    return {
      delta,
      desiredBonus,
      earned,
      cap,
      leveledUp,
      newLevel: after,
    };
  },
}));
