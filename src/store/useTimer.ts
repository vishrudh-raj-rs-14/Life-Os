"use client";

import { create } from "zustand";

interface TimerState {
  goalId?: string;
  startedAt?: number;
  notes: string;
  start: (goalId: string) => void;
  stop: () => { goalId: string; startedAt: number; endedAt: number; minutes: number; notes: string } | null;
  setNotes: (s: string) => void;
  hydrate: () => void;
}

const KEY = "compound-active-timer";

export const useTimer = create<TimerState>((set, get) => ({
  goalId: undefined,
  startedAt: undefined,
  notes: "",
  start(goalId) {
    const startedAt = Date.now();
    set({ goalId, startedAt, notes: "" });
    if (typeof window !== "undefined") {
      localStorage.setItem(
        KEY,
        JSON.stringify({ goalId, startedAt, notes: "" })
      );
    }
  },
  stop() {
    const { goalId, startedAt, notes } = get();
    if (!goalId || !startedAt) return null;
    const endedAt = Date.now();
    const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60000));
    set({ goalId: undefined, startedAt: undefined, notes: "" });
    if (typeof window !== "undefined") {
      localStorage.removeItem(KEY);
    }
    return { goalId, startedAt, endedAt, minutes, notes };
  },
  setNotes(notes) {
    set({ notes });
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem(KEY);
      if (cur) {
        const j = JSON.parse(cur);
        localStorage.setItem(KEY, JSON.stringify({ ...j, notes }));
      }
    }
  },
  hydrate() {
    if (typeof window === "undefined") return;
    const cur = localStorage.getItem(KEY);
    if (!cur) return;
    try {
      const j = JSON.parse(cur);
      set({ goalId: j.goalId, startedAt: j.startedAt, notes: j.notes ?? "" });
    } catch {
      /* noop */
    }
  },
}));
