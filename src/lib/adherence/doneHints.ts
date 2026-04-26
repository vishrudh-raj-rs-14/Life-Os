import type { Habit } from "@/types";

/** Short explainer for Today cards (reduces ambiguity). */
export function habitDoneHint(h: Habit, graceMinutes: number): string {
  const g = Math.max(15, Math.min(120, graceMinutes));
  const schedBonus =
    h.scheduledTime != null && h.scheduledTime !== ""
      ? ` Logging near ${h.scheduledTime} (±${g}m) tweaks XP slightly — late still counts.`
      : "";

  switch (h.kind) {
    case "binary":
      return `Mark done once today counts.${schedBonus} Stuck? A two-minute version still counts.`.trim();
    case "count": {
      const u = h.unit ? ` ${h.unit}` : "";
      return `Total today should reach ${h.target}${u}.${schedBonus}`;
    }
    case "duration":
      return `Accumulate ${h.target} minutes today (timer or quick adds).${schedBonus}`;
    case "checklist":
      return `Check every step to finish today’s routine.${schedBonus}`;
    default:
      return `Complete today’s target once.${schedBonus}`;
  }
}
