import type { Tone } from "@/types";

export interface ToneTemplate {
  reminder: (habit: string, time: string) => string;
  miss: (habit: string) => string;
  morning: (total: number) => string;
  midday: (done: number, total: number) => string;
  streakRisk: (streak: number, missed: number) => string;
  dayAfterMiss: (missed: number) => string;
  recapAll: (count: number) => string;
  recapMiss: (missed: number, total: number) => string;
  celebration: (count: number) => string;
}

const TONE_TEMPLATES: Record<Tone, ToneTemplate> = {
  coach: {
    reminder: (h, t) => `${t}: ${h}. You've got this.`,
    miss: (h) => `${h} hasn't been logged yet. Quick win — do it now.`,
    morning: (total) =>
      `${total} habit${total === 1 ? "" : "s"} queued. Let's have a clean day.`,
    midday: (done, total) =>
      `${done}/${total} done so far. Afternoon is yours — use it.`,
    streakRisk: (streak, missed) =>
      `${missed} habit${missed === 1 ? "" : "s"} left. Your ${streak}-day streak is on the line.`,
    dayAfterMiss: (missed) =>
      `${missed} habit${missed === 1 ? "" : "s"} missed yesterday. Today is the reset — don't waste it.`,
    recapAll: (c) => `${c} quests cleared. Rest well. Tomorrow we go again.`,
    recapMiss: (m, t) =>
      `${t - m}/${t} today. Tomorrow is a clean slate — set your alarm.`,
    celebration: (c) => `🔥 ${c} habits crushed today.`,
  },

  "drill-sergeant": {
    reminder: (h, t) => `${t}. ${h}. NOW. No excuses.`,
    miss: (h) => `You said you'd do ${h}. Where is it. Move.`,
    morning: (total) =>
      `${total} objectives today. No waiting. Start immediately.`,
    midday: (done, total) =>
      `${done}/${total} done. That's weak. You have hours left. Move.`,
    streakRisk: (streak, missed) =>
      `${missed} left. You've kept this streak ${streak} days. Don't you dare break it tonight.`,
    dayAfterMiss: (missed) =>
      `${missed} missed yesterday. That's not who you said you'd be. Today: zero excuses.`,
    recapAll: (c) => `${c} done. That's the minimum. Repeat tomorrow.`,
    recapMiss: (m, t) =>
      `${m}/${t} missed. Unacceptable. Set the alarm. Try again.`,
    celebration: (c) => `${c} done. Don't get comfortable.`,
  },

  wise: {
    reminder: (h, t) => `${t} — the time you set for ${h}. Honour it.`,
    miss: (h) =>
      `The work you avoid today becomes the wall you face tomorrow. ${h} awaits.`,
    morning: (total) =>
      `${total} intentions set. The day is open. Begin with the smallest one.`,
    midday: (done, total) =>
      `${done} of ${total} complete. The afternoon is still yours to shape.`,
    streakRisk: (streak, missed) =>
      `${streak} days of showing up. ${missed} habit${missed === 1 ? "" : "s"} remain. What you do in the next hour defines the pattern.`,
    dayAfterMiss: (missed) =>
      `${missed} missed yesterday. Notice without judgment. The practice begins again now.`,
    recapAll: () => `You showed up. That, repeated, is everything.`,
    recapMiss: (m, t) =>
      `${t - m}/${t}. Notice without judgment. Adjust tomorrow.`,
    celebration: (c) => `${c} small acts. Compounded, they become a life.`,
  },
};

export function tone(t: Tone) {
  return TONE_TEMPLATES[t] ?? TONE_TEMPLATES.coach;
}
