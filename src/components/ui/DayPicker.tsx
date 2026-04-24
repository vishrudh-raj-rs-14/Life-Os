"use client";

import { cn } from "@/lib/utils";

// 0 = Sun … 6 = Sat  (matches Date.getDay())
const DAYS = [
  { label: "S", name: "Sun", idx: 0 },
  { label: "M", name: "Mon", idx: 1 },
  { label: "T", name: "Tue", idx: 2 },
  { label: "W", name: "Wed", idx: 3 },
  { label: "T", name: "Thu", idx: 4 },
  { label: "F", name: "Fri", idx: 5 },
  { label: "S", name: "Sat", idx: 6 },
];

const PRESETS: { label: string; days: number[] }[] = [
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Alt days", days: [1, 3, 5] },
  { label: "M W F S",  days: [1, 3, 5, 6] },
  { label: "Weekends", days: [0, 6] },
];

interface DayPickerProps {
  selected: number[];
  onChange: (days: number[]) => void;
  /** When true, only one day can be active (weekly mode) */
  single?: boolean;
  label?: string;
}

export function DayPicker({ selected, onChange, single = false, label }: DayPickerProps) {
  function toggle(idx: number) {
    if (single) {
      onChange([idx]);
      return;
    }
    const next = selected.includes(idx)
      ? selected.filter(d => d !== idx)
      : [...selected, idx].sort((a, b) => a - b);
    // Prevent deselecting all days
    if (next.length === 0) return;
    onChange(next);
  }

  function applyPreset(days: number[]) {
    onChange(days);
  }

  const sel = new Set(selected);

  return (
    <div className="space-y-3">
      {label && <div className="os-label">{label}</div>}

      {/* Quick presets */}
      {!single && (
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map(p => {
            const active =
              p.days.length === selected.length &&
              p.days.every(d => sel.has(d));
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wide border transition-all",
                  active
                    ? "bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]"
                    : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--ink-3)] hover:border-[var(--ink-3)]"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Day circles */}
      <div className="flex justify-between gap-1">
        {DAYS.map(({ label: lbl, name, idx }) => {
          const on = sel.has(idx);
          return (
            <button
              key={idx}
              type="button"
              title={name}
              onClick={() => toggle(idx)}
              className={cn(
                "relative flex-1 aspect-square max-w-[42px] rounded-full flex items-center justify-center",
                "text-[13px] font-bold font-mono transition-all duration-150 select-none",
                "active:scale-90",
                on
                  ? "bg-[var(--accent)] text-[var(--bg)] shadow-md shadow-[var(--accent)]/30 scale-105"
                  : "bg-[var(--surface-2)] text-[var(--ink-3)] border border-[var(--border)] hover:border-[var(--ink-3)]"
              )}
            >
              {lbl}
              {/* dot for "today" indicator */}
              {idx === new Date().getDay() && (
                <span className={cn(
                  "absolute bottom-[5px] left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full",
                  on ? "bg-[var(--bg)]/60" : "bg-[var(--accent)]"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Count summary */}
      <p className="text-[11px] font-mono text-[var(--ink-3)]">
        {selected.length === 7
          ? "every day"
          : selected.length === 0
          ? "no days selected"
          : `${selected.length}× per week · ${selected.map(d => DAYS[d].name).join(", ")}`}
      </p>
    </div>
  );
}
