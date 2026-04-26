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

type DailyBonusResult = {
  delta: number;
  desiredBonus: number;
  earned: number;
  cap: number;
  leveledUp: boolean;
  newLevel: number;
};

const NO_DAILY_BONUS_CHANGE: DailyBonusResult = {
  delta: 0,
  desiredBonus: 0,
  earned: 0,
  cap: 0,
  leveledUp: false,
  newLevel: 1,
};

let dailyBonusTimer: ReturnType<typeof setTimeout> | undefined;
let resolvePendingDailyBonus: ((value: DailyBonusResult) => void) | undefined;

function queueProfileSync(user: UserProfile) {
  void getRepo()
    .then((repo) => repo.upsertUser(user))
    .catch(() => {});
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
    todayLogs: Log[],
    graceMinutes?: number
  ) => Promise<DailyBonusResult>;
  grantStreakFreezes: (n: number) => Promise<void>;
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
    if (!get().user) await get().load();

    let result = { leveledUp: false, newLevel: 1 };
    let updated: UserProfile | undefined;

    set((state) => {
      const u = state.user;
      if (!u) return state;
      const before = levelFromXp(u.totalXp).level;
      const totalXp = Math.max(0, u.totalXp + amount);
      const after = levelFromXp(totalXp).level;
      updated = {
        ...u,
        totalXp,
        level: after,
        updatedAt: Date.now(),
      };
      result = { leveledUp: after > before, newLevel: after };
      return { user: updated };
    });

    if (updated) queueProfileSync(updated);
    return result;
  },
  async bumpStreak() {
    if (!get().user) await get().load();

    let updated: UserProfile | undefined;
    set((state) => {
      const u = state.user;
      if (!u) return state;
      const today = todayISO();
      if (u.lastActiveDate === today) return state;
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      updated = {
        ...u,
        streakDays: u.lastActiveDate === yestStr ? u.streakDays + 1 : 1,
        lastActiveDate: today,
        updatedAt: Date.now(),
      };
      return { user: updated };
    });

    if (updated) queueProfileSync(updated);
  },
  async grantStreakFreezes(n) {
    if (n <= 0) return;
    if (!get().user) await get().load();
    let updated: UserProfile | undefined;
    set((state) => {
      const u = state.user;
      if (!u) return state;
      updated = {
        ...u,
        streakFreezes: Math.min(99, (u.streakFreezes ?? 0) + n),
        updatedAt: Date.now(),
      };
      return { user: updated };
    });
    if (updated) queueProfileSync(updated);
  },
  async syncDailyXpBonus(today, dueHabits, todayLogs, graceMinutes = 45) {
    if (dailyBonusTimer) clearTimeout(dailyBonusTimer);
    resolvePendingDailyBonus?.(NO_DAILY_BONUS_CHANGE);

    return new Promise<DailyBonusResult>((resolve) => {
      resolvePendingDailyBonus = resolve;
      dailyBonusTimer = setTimeout(() => {
        dailyBonusTimer = undefined;
        resolvePendingDailyBonus = undefined;

        const dueIds = new Set(dueHabits.map((h) => h.id));
        const cap = dueHabits.reduce(
          (a, h) => a + maxDailyXpForHabit(h, { todayISO: today, graceMinutes }),
          0
        );
        const earned = dailyXpEarnedFromLogs(todayLogs, today, dueIds);
        let response: DailyBonusResult = {
          delta: 0,
          desiredBonus: 0,
          earned,
          cap,
          leveledUp: false,
          newLevel: levelFromXp(get().user?.totalXp ?? 0).level,
        };
        let updated: UserProfile | undefined;

        set((state) => {
          let u = state.user;
          if (!u) return state;

          if (u.dailyBonusDate && u.dailyBonusDate !== today) {
            u = {
              ...u,
              dailyBonusDate: undefined,
              dailyBonusXp: undefined,
              updatedAt: Date.now(),
            };
          }

          const tracked =
            u.dailyBonusDate === today && typeof u.dailyBonusXp === "number"
              ? u.dailyBonusXp
              : 0;
          const desiredBonus =
            cap > 0 && earned >= cap ? dailyBarBonusAmount(cap) : 0;
          const delta = desiredBonus - tracked;

          if (delta === 0 && u === state.user) {
            response = {
              delta: 0,
              desiredBonus,
              earned,
              cap,
              leveledUp: false,
              newLevel: levelFromXp(u.totalXp).level,
            };
            return state;
          }

          const before = levelFromXp(u.totalXp).level;
          const totalXp = Math.max(0, u.totalXp + delta);
          const after = levelFromXp(totalXp).level;
          updated = {
            ...u,
            totalXp,
            level: after,
            dailyBonusDate: desiredBonus > 0 ? today : undefined,
            dailyBonusXp: desiredBonus > 0 ? desiredBonus : undefined,
            updatedAt: Date.now(),
          };
          response = {
            delta,
            desiredBonus,
            earned,
            cap,
            leveledUp: after > before,
            newLevel: after,
          };
          return { user: updated };
        });

        if (updated) queueProfileSync(updated);
        resolve(response);
      }, 500);
    });
  },
}));
