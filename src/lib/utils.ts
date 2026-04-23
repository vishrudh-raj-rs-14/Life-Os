import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LOCAL_USER_ID = "local-user";

export function todayISO(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function isoToDate(iso: string): Date {
  return parseISO(iso);
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const r = Math.round(m - h * 60);
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Wrapped so React 19's purity lint doesn't flag direct Date.now() inside
// event handlers / async callbacks.
export function nowMs(): number {
  return Date.now();
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  }
}
