"use client";

import { create } from "zustand";

export interface TimerSnapshot {
  goalId: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
  notes: string;
}

interface TimerState {
  goalId?: string;
  startedAt?: number;
  /** Wall clock when pause began; undefined = running */
  pausedAt?: number;
  /** Sum of completed pause intervals (ms) */
  totalPausedMs: number;
  notes: string;
  start: (goalId: string) => void;
  pause: () => void;
  resume: () => void;
  /** Active elapsed ms at this instant (frozen while paused) */
  elapsedMs: (now?: number) => number;
  stop: () => TimerSnapshot | null;
  discard: () => void;
  setNotes: (s: string) => void;
  hydrate: () => void;
}

const KEY = "compound-active-timer";

function persist(state: {
  goalId?: string;
  startedAt?: number;
  pausedAt?: number;
  totalPausedMs: number;
  notes: string;
}) {
  if (typeof window === "undefined") return;
  if (!state.goalId || !state.startedAt) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(
    KEY,
    JSON.stringify({
      goalId: state.goalId,
      startedAt: state.startedAt,
      pausedAt: state.pausedAt,
      totalPausedMs: state.totalPausedMs,
      notes: state.notes,
    })
  );
}

export const useTimer = create<TimerState>((set, get) => ({
  goalId: undefined,
  startedAt: undefined,
  pausedAt: undefined,
  totalPausedMs: 0,
  notes: "",

  elapsedMs(now = Date.now()) {
    const { startedAt, pausedAt, totalPausedMs } = get();
    if (!startedAt) return 0;
    const end = pausedAt ?? now;
    return Math.max(0, end - startedAt - totalPausedMs);
  },

  start(goalId) {
    const startedAt = Date.now();
    set({
      goalId,
      startedAt,
      pausedAt: undefined,
      totalPausedMs: 0,
      notes: "",
    });
    persist(get());
  },

  pause() {
    const { goalId, startedAt, pausedAt } = get();
    if (!goalId || !startedAt || pausedAt) return;
    const t = Date.now();
    set({ pausedAt: t });
    persist(get());
  },

  resume() {
    const { pausedAt, totalPausedMs } = get();
    if (!pausedAt) return;
    const t = Date.now();
    set({
      pausedAt: undefined,
      totalPausedMs: totalPausedMs + (t - pausedAt),
    });
    persist(get());
  },

  stop() {
    const { goalId, startedAt, notes, pausedAt, totalPausedMs } = get();
    if (!goalId || !startedAt) return null;
    const endedAt = Date.now();
    // If paused, freeze elapsed at pause moment
    const endClock = pausedAt ?? endedAt;
    const activeMs = Math.max(0, endClock - startedAt - totalPausedMs);
    const minutes = Math.max(1, Math.round(activeMs / 60000));
    set({
      goalId: undefined,
      startedAt: undefined,
      pausedAt: undefined,
      totalPausedMs: 0,
      notes: "",
    });
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
    return { goalId, startedAt, endedAt, minutes, notes };
  },

  discard() {
    set({
      goalId: undefined,
      startedAt: undefined,
      pausedAt: undefined,
      totalPausedMs: 0,
      notes: "",
    });
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
  },

  setNotes(notes) {
    set({ notes });
    persist(get());
  },

  hydrate() {
    if (typeof window === "undefined") return;
    const cur = localStorage.getItem(KEY);
    if (!cur) return;
    try {
      const j = JSON.parse(cur);
      set({
        goalId: j.goalId,
        startedAt: j.startedAt,
        pausedAt: j.pausedAt,
        totalPausedMs: typeof j.totalPausedMs === "number" ? j.totalPausedMs : 0,
        notes: j.notes ?? "",
      });
    } catch {
      /* noop */
    }
  },
}));
