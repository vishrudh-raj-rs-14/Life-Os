"use client";

import { db } from "@/lib/db/dexie";
import {
  buildStreakDates,
  computeStreak,
  habitDoneToday,
  isHabitDueToday,
} from "@/lib/engine";
import { todayISO } from "@/lib/utils";
import { tone } from "./tones";
import type { Tone } from "@/types";

let bootInterval: number | null = null;

// ─── Permission ───────────────────────────────────────────────────────────────

export async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

// ─── Fire helpers ─────────────────────────────────────────────────────────────

function fireLocal(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      requireInteraction: false,
    });
  } catch {
    /* iOS may throw — ignore */
  }
}

// ─── Fired-key dedup (localStorage) ──────────────────────────────────────────

const FIRED_KEY = "lifeos-fired";
function getFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function setFired(map: Record<string, number>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify(map));
}
function once(key: string, fired: Record<string, number>): boolean {
  if (fired[key]) return false; // already fired
  return true;
}

// ─── Main tick ────────────────────────────────────────────────────────────────

async function tickOnce(userTone: Tone) {
  const today = todayISO();
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  const tpl = tone(userTone);

  const habits = await db().habits.filter((h) => !h.archived).toArray();
  const logs = await db().logs.where("date").equals(today).toArray();
  const reminders = await db().reminders.toArray();
  const fired = getFired();

  // ── 1. Habit-specific reminders ──────────────────────────────────────────
  for (const r of reminders) {
    if (!r.enabled) continue;
    if (r.time !== time) continue;
    const key = `r:${r.id}:${today}`;
    if (!once(key, fired)) continue;
    const h = habits.find((x) => x.id === r.habitId);
    if (!h || !isHabitDueToday(h, now)) continue;
    if (habitDoneToday(h, logs, today).done) continue;
    fireLocal("Life OS", tpl.reminder(h.title, r.time), key);
    fired[key] = Date.now();
  }

  const dueToday = habits.filter((h) => isHabitDueToday(h, now));
  const doneCount = dueToday.filter((h) => habitDoneToday(h, logs, today).done).length;
  const missedCount = dueToday.length - doneCount;
  const completionRatio = dueToday.length > 0 ? doneCount / dueToday.length : 1;

  // ── 2. Morning nudge — 09:00, only if nothing done yet ─────────────────
  if (time === "09:00") {
    const key = `morning:${today}`;
    if (once(key, fired) && doneCount === 0 && dueToday.length > 0) {
      fireLocal(
        "Life OS — good morning",
        tpl.morning(dueToday.length),
        key
      );
      fired[key] = Date.now();
    }
  }

  // ── 3. Midday check-in — 13:00, if <30% done ──────────────────────────
  if (time === "13:00") {
    const key = `midday:${today}`;
    if (once(key, fired) && completionRatio < 0.3 && dueToday.length > 0) {
      fireLocal(
        "Still waiting on you",
        tpl.midday(doneCount, dueToday.length),
        key
      );
      fired[key] = Date.now();
    }
  }

  // ── 4. Streak-at-risk — 20:00, if streak ≥2 and not yet "counted" today
  if (time === "20:00") {
    const allLogs = await db().logs.toArray();
    const activeDates = buildStreakDates(habits, allLogs);
    const streak = computeStreak(activeDates, today);
    const todayCounts = activeDates.has(today);

    if (!todayCounts && streak >= 2) {
      const key = `streak-risk:${today}`;
      if (once(key, fired)) {
        fireLocal(
          `🔥 ${streak}-day streak at risk`,
          tpl.streakRisk(streak, missedCount),
          key
        );
        fired[key] = Date.now();
      }
    }
  }

  // ── 5. Evening recap — 21:30 ─────────────────────────────────────────────
  if (time === "21:30") {
    const key = `recap:${today}`;
    if (once(key, fired) && dueToday.length > 0) {
      const body =
        missedCount === 0
          ? tpl.recapAll(doneCount)
          : tpl.recapMiss(missedCount, dueToday.length);
      fireLocal("End of day", body, key);
      fired[key] = Date.now();
    }
  }

  // ── 6. Day-after miss — 08:05, if yesterday wasn't a streak day ─────────
  if (time === "08:05") {
    const yesterday = formatDate(new Date(now.getTime() - 24 * 3600 * 1000));
    const key = `daymiss:${yesterday}`;
    if (once(key, fired)) {
      const yesterdayLogs = await db().logs.where("date").equals(yesterday).toArray();
      const dueYesterday = habits.filter((h) =>
        isHabitDueToday(h, new Date(yesterday))
      );
      if (dueYesterday.length > 0) {
        const doneYesterday = dueYesterday.filter(
          (h) => habitDoneToday(h, yesterdayLogs, yesterday).done
        ).length;
        const ratioYesterday =
          dueYesterday.length > 0 ? doneYesterday / dueYesterday.length : 1;
        if (ratioYesterday < 0.5) {
          fireLocal(
            "Yesterday was a miss.",
            tpl.dayAfterMiss(dueYesterday.length - doneYesterday),
            key
          );
          fired[key] = Date.now();
        }
      }
    }
  }

  // ── 7. Voice note lookbacks — 10:00 ──────────────────────────────────────
  if (time === "10:00") {
    const allNotes = await db().voiceNotes.toArray();

    // 1-month lookback
    const oneMonthAgo = formatDate(
      new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    );
    const monthKey = `noteslookback:month:${today}`;
    if (once(monthKey, fired)) {
      const monthNotes = allNotes.filter((n) => n.date === oneMonthAgo);
      if (monthNotes.length > 0) {
        fireLocal(
          `🎙 A month ago`,
          monthNotes.length === 1
            ? "You left yourself a voice note. Listen back."
            : `You left ${monthNotes.length} voice notes. Listen back.`,
          monthKey
        );
        fired[monthKey] = Date.now();
      }
    }

    // 1-year lookback
    const oneYearAgo = formatDate(
      new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    );
    const yearKey = `noteslookback:year:${today}`;
    if (once(yearKey, fired)) {
      const yearNotes = allNotes.filter((n) => n.date === oneYearAgo);
      if (yearNotes.length > 0) {
        fireLocal(
          `📅 A year ago today`,
          yearNotes.length === 1
            ? "You left yourself a voice note. Things change."
            : `You left ${yearNotes.length} voice notes. A year later — where are you?`,
          yearKey
        );
        fired[yearKey] = Date.now();
      }
    }
  }

  setFired(fired);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function startScheduler(userTone: Tone) {
  if (typeof window === "undefined") return;
  if (bootInterval !== null) return;
  // tick every 30s — cheap and sufficient for HH:mm precision
  bootInterval = window.setInterval(() => void tickOnce(userTone), 30 * 1000);
  void tickOnce(userTone);
}

export function stopScheduler() {
  if (bootInterval !== null) {
    clearInterval(bootInterval);
    bootInterval = null;
  }
}
