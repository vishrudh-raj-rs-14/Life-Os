"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Minus, Plus, Timer, Zap } from "lucide-react";
import type { Habit, Log } from "@/types";
import { cn, fmtMinutes, vibrate } from "@/lib/utils";

interface Props {
  habit: Habit;
  value: number;
  done: boolean;
  progress: number;
  xp: number;
  optional?: boolean;       // alt-day habit on an off day — shown but not forced
  todayStepsMask?: number[]; // for checklist
  recent: Array<{ date: string; value: number; target: number }>;
  onLog: (delta: number) => void; // +N or -N (count/duration)
  onToggleBinary: () => void;
  onToggleStep: (index: number) => void; // checklist
}

export function QuestCard({
  habit,
  optional,
  value,
  done,
  progress,
  xp,
  todayStepsMask,
  recent,
  onLog,
  onToggleBinary,
  onToggleStep,
}: Props) {
  return (
    <motion.div
      layout
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border p-3 transition",
        optional && !done
          ? "border-[var(--border)] bg-[var(--surface)] opacity-60"
          : done
            ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.06]"
            : "border-[var(--border)] bg-[var(--surface)]"
      )}
    >
      {/* header row */}
      <div className="flex items-start gap-3">
        <KindGlyph habit={habit} done={done} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {habit.color && (
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: habit.color }}
              />
            )}
            <h4
              className={cn(
                "text-[15px] font-medium truncate",
                done && "text-[var(--ink-2)]"
              )}
            >
              {habit.title}
            </h4>
            {optional && !done && (
              <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--ink-3)] border border-[var(--border)] rounded px-1 py-0.5 shrink-0">
                bonus
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] mt-0.5 uppercase tracking-wide">
            {habit.scheduledTime && <span>{habit.scheduledTime}</span>}
            {habit.scheduledTime && habit.cue && <span>·</span>}
            {habit.cue && <span className="truncate normal-case tracking-normal">{habit.cue}</span>}
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono",
            "border-[var(--accent)]/30 text-[var(--accent)]"
          )}
          title="XP at full completion"
        >
          <Zap size={10} />+{xp}
        </div>
      </div>

      {/* control row — varies by habit kind */}
      <div className="flex items-center gap-2">
        {habit.kind === "binary" && (
          <button
            onClick={() => {
              vibrate(done ? 10 : [20, 30, 40]);
              onToggleBinary();
            }}
            className={cn(
              "flex-1 h-11 rounded-xl border text-sm font-medium transition flex items-center justify-center gap-2",
              done
                ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
                : "bg-transparent border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            )}
          >
            {done ? <Check size={18} /> : <Plus size={18} />}
            {done ? "Done" : "Mark done"}
          </button>
        )}

        {habit.kind === "count" && (
          <Stepper
            value={value}
            target={habit.target}
            unit={habit.unit ?? ""}
            onLog={onLog}
            done={done}
          />
        )}

        {habit.kind === "duration" && (
          <DurationControl
            value={value}
            target={habit.target}
            onLog={onLog}
            goalId={habit.id}
            done={done}
          />
        )}

        {habit.kind === "checklist" && habit.steps && (
          <Checklist
            steps={habit.steps}
            mask={todayStepsMask ?? []}
            onToggle={onToggleStep}
          />
        )}
      </div>

      {/* progress + consistency row */}
      <div className="flex items-center gap-3">
        <ProgressBar progress={progress} done={done} />
        <ConsistencyStrip recent={recent} />
      </div>
    </motion.div>
  );
}

function KindGlyph({ habit, done }: { habit: Habit; done: boolean }) {
  const ch =
    habit.kind === "binary"
      ? "·"
      : habit.kind === "count"
        ? "#"
        : habit.kind === "duration"
          ? "⏱"
          : "☰";
  return (
    <div
      className={cn(
        "h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center font-mono text-sm",
        done
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)]"
      )}
      title={habit.kind}
    >
      {ch}
    </div>
  );
}

function Stepper({
  value,
  target,
  unit,
  onLog,
  done,
}: {
  value: number;
  target: number;
  unit: string;
  onLog: (delta: number) => void;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      <button
        onClick={() => {
          if (value <= 0) return;
          vibrate(8);
          onLog(-1);
        }}
        disabled={value <= 0}
        className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)] disabled:opacity-40 flex items-center justify-center"
        aria-label="decrement"
      >
        <Minus size={16} />
      </button>
      <div
        className={cn(
          "flex-1 h-10 rounded-lg border flex items-baseline justify-center gap-1 font-mono",
          done
            ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-1)]"
        )}
      >
        <span className="text-base font-semibold">{value}</span>
        <span className="text-xs text-[var(--ink-3)]">/ {target}</span>
        {unit && <span className="text-[11px] text-[var(--ink-3)] ml-1">{unit}</span>}
      </div>
      <button
        onClick={() => {
          vibrate([10, 20, 10]);
          onLog(1);
        }}
        className="h-10 w-10 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center"
        aria-label="increment"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function DurationControl({
  value,
  target,
  onLog,
  goalId,
  done,
}: {
  value: number;
  target: number;
  onLog: (delta: number) => void;
  goalId?: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div
        className={cn(
          "flex-1 h-10 rounded-lg border flex items-baseline justify-center gap-1 font-mono",
          done
            ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-1)]"
        )}
      >
        <span className="text-base font-semibold">{fmtMinutes(value)}</span>
        <span className="text-xs text-[var(--ink-3)]">/ {fmtMinutes(target)}</span>
      </div>
      {[15, 30].map((m) => (
        <button
          key={m}
          onClick={() => {
            vibrate(8);
            onLog(m);
          }}
          className="h-10 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)] text-xs font-mono"
        >
          +{m}
        </button>
      ))}
      <Link
        href={`/focus${goalId ? `?goalId=${goalId}` : ""}`}
        className="h-10 px-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-mono inline-flex items-center gap-1"
      >
        <Timer size={12} /> Focus
      </Link>
    </div>
  );
}

function Checklist({
  steps,
  mask,
  onToggle,
}: {
  steps: string[];
  mask: number[];
  onToggle: (i: number) => void;
}) {
  const set = new Set(mask);
  return (
    <div className="w-full grid gap-1.5">
      {steps.map((s, i) => {
        const checked = set.has(i);
        return (
          <button
            key={i}
            onClick={() => {
              vibrate(8);
              onToggle(i);
            }}
            className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-sm",
              checked
                ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--ink-1)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)]"
            )}
          >
            <span
              className={cn(
                "h-4 w-4 rounded-sm border flex items-center justify-center",
                checked
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                  : "border-[var(--border)]"
              )}
            >
              {checked && <Check size={12} />}
            </span>
            <span className={cn(checked && "line-through text-[var(--ink-3)]")}>
              {s}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProgressBar({ progress, done }: { progress: number; done: boolean }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
      <div
        className={cn(
          "h-full transition-all",
          done ? "bg-[var(--accent)]" : "bg-[var(--accent)]/60"
        )}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

function ConsistencyStrip({
  recent,
}: {
  recent: Array<{ date: string; value: number; target: number }>;
}) {
  return (
    <div className="flex gap-[2px]" title="Last 14 days">
      {recent.map((r) => {
        const ratio = r.target > 0 ? Math.min(1, r.value / r.target) : 0;
        const cls =
          ratio >= 1
            ? "bg-[var(--accent)]"
            : ratio > 0
              ? "bg-[var(--accent)]/40"
              : "bg-[var(--surface-2)] border border-[var(--border)]";
        return (
          <span key={r.date} className={cn("h-3 w-1 rounded-[1px]", cls)} title={r.date} />
        );
      })}
    </div>
  );
}

export type { Log };
