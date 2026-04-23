"use client";

import { create } from "zustand";
import type { UserProfile } from "@/types";
import { getRepo } from "@/lib/repo";
import { levelFromXp } from "@/lib/engine";
import { todayISO } from "@/lib/utils";

interface UserState {
  user?: UserProfile;
  loading: boolean;
  load: () => Promise<void>;
  setUser: (u: UserProfile) => Promise<void>;
  awardXp: (amount: number) => Promise<{ leveledUp: boolean; newLevel: number }>;
  bumpStreak: () => Promise<void>;
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
    await repo.upsertUser(u);
    set({ user: u });
  },
  async awardXp(amount) {
    const repo = await getRepo();
    const u = (await repo.getUser())!;
    const before = levelFromXp(u.totalXp).level;
    const totalXp = u.totalXp + amount;
    const after = levelFromXp(totalXp).level;
    const updated: UserProfile = {
      ...u,
      totalXp,
      level: after,
      updatedAt: Date.now(),
    };
    await repo.upsertUser(updated);
    set({ user: updated });
    return { leveledUp: after > before, newLevel: after };
  },
  async bumpStreak() {
    const repo = await getRepo();
    const u = (await repo.getUser())!;
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
    await repo.upsertUser(updated);
    set({ user: updated });
    // ignore returned value to keep type loose; caller can re-read
    void get();
  },
}));
