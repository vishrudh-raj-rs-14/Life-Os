"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { addDays, format, startOfWeek, endOfWeek } from "date-fns";
import { ArrowLeft, Mic, MicOff, Play, Pause } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { getRepo } from "@/lib/repo";
import { Textarea } from "@/components/ui/Input";
import { cn, todayISO } from "@/lib/utils";
import { useUser } from "@/store/useUser";
import { habitDoneToday, isHabitDueToday } from "@/lib/engine";
import type { Habit } from "@/types";

// ─── tiny inline recorder (reused pattern from notes page) ───────────────────

function MiniRecorder() {
  const user = useUser((s) => s.user);
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [playing, setPlaying] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRec() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(100);
    setState("recording");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }

  async function stopRec() {
    if (!mediaRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await new Promise<void>(res => { mediaRef.current!.onstop = () => res(); mediaRef.current!.stop(); });
    const b = new Blob(chunksRef.current, { type: "audio/webm" });
    const audio = new Audio(URL.createObjectURL(b));
    audio.onended = () => setPlaying(false);
    audioRef.current = audio;

    if (!user?.userId) {
      setState("idle");
      return;
    }
    const repo = await getRepo();
    const t = Date.now();
    await repo.upsertVoiceNote({
      id: nanoid(),
      userId: user.userId,
      blob: b,
      duration: elapsed,
      date: todayISO(),
      mimeType: b.type || "audio/webm",
      createdAt: t,
      updatedAt: t,
    });
    setState("done");
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  }

  return (
    <div className="os-block p-3 flex items-center gap-3">
      {state === "done" ? (
        <>
          <button onClick={togglePlay}
            className="h-9 w-9 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)]">
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <div className="flex-1">
            <div className="text-[12px] text-[var(--ink-1)]">Voice note saved</div>
            <div className="text-[10px] text-[var(--ink-3)] font-mono">in Notes · {format(new Date(), "d MMM")}</div>
          </div>
          <button onClick={() => { setState("idle"); setElapsed(0); }}
            className="text-[10px] font-mono text-[var(--ink-3)] hover:text-[var(--ink-2)]">
            record another
          </button>
        </>
      ) : (
        <>
          <button
            onClick={state === "recording" ? stopRec : startRec}
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center transition",
              state === "recording"
                ? "bg-[var(--danger)] text-white animate-pulse"
                : "bg-[var(--accent)] text-[var(--bg)]"
            )}>
            {state === "recording" ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <div className="flex-1 text-[12px] text-[var(--ink-2)]">
            {state === "recording"
              ? `Recording… ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
              : "Add a voice note to this review"}
          </div>
        </>
      )}
    </div>
  );
}

// ─── habit row ────────────────────────────────────────────────────────────────

function GoalRow({ habit, due, done }: { habit: Habit; due: number; done: number }) {
  const ratio = due > 0 ? done / due : 0;
  const color = habit.color ?? "var(--accent)";
  return (
    <div className={cn(
      "os-block px-3 py-2.5",
      ratio >= 1 ? "border-[var(--success)]/30"
        : ratio >= 0.5 ? "border-[var(--warn)]/30"
        : due > 0 ? "border-[var(--danger)]/20" : ""
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-sm truncate text-[var(--ink-1)]">{habit.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "font-mono text-[12px] tabular-nums",
            ratio >= 1 ? "text-[var(--success)]"
              : ratio >= 0.5 ? "text-[var(--warn)]"
              : "text-[var(--danger)]"
          )}>
            {done}/{due}
          </span>
        </div>
      </div>
      {due > 0 && (
        <div className="h-1 mt-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${ratio * 100}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const habits = useLiveQuery(
    () => db().habits.filter(h => !h.archived && !h.deletedAt).toArray(), []
  );
  const logs = useLiveQuery(() => db().logs.toArray(), []);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(new Date(), { weekStartsOn: 1 });

  const rows = useMemo(() => {
    if (!habits || !logs) return [];
    return habits.map(h => {
      let due = 0, done = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        if (d > new Date()) break;
        const ds = d.toISOString().slice(0, 10);
        if (!isHabitDueToday(h, d)) continue;
        due++;
        if (habitDoneToday(h, logs, ds).done) done++;
      }
      return { habit: h, due, done, ratio: due > 0 ? done / due : 0 };
    });
  }, [habits, logs, weekStart]);

  const totalDue  = rows.reduce((a, r) => a + r.due, 0);
  const totalDone = rows.reduce((a, r) => a + r.done, 0);
  const score = totalDue ? Math.round((totalDone / totalDue) * 100) : 0;

  const verdict =
    score >= 90 ? { label: "Outstanding week. Lock the system in.", color: "var(--success)" }
    : score >= 70 ? { label: "Solid week. Push the multiplier next.", color: "var(--success)" }
    : score >= 50 ? { label: "Inconsistent. Pick two that matter and protect them.", color: "var(--warn)" }
    : { label: "This week was rough. Simplify and reset.", color: "var(--danger)" };

  // Reflection
  const [keep, setKeep] = useState("");
  const [cut,  setCut]  = useState("");
  const [add,  setAdd]  = useState("");

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      {/* header */}
      <div className="flex items-center gap-2">
        <Link href="/" className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="os-label">
            {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">Weekly review</h1>
        </div>
      </div>

      {/* score */}
      <div className="os-block-strong p-5 text-center">
        <div className="os-label mb-1">Completion score</div>
        <div className="serif text-7xl" style={{ color: verdict.color }}>{score}</div>
        <div className="text-sm font-medium mt-2" style={{ color: verdict.color }}>
          {verdict.label}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <StatCell label="Goals hit" value={`${totalDone}/${totalDue}`} />
          <StatCell label="Completion" value={`${score}%`} />
        </div>
      </div>

      {/* per-goal breakdown */}
      <section>
        <div className="os-label mb-2">Goals this week</div>
        <div className="space-y-1.5">
          {rows.map(({ habit, due, done }) => (
            <GoalRow key={habit.id} habit={habit} due={due} done={done} />
          ))}
          {rows.length === 0 && (
            <div className="os-block p-4 text-center text-sm text-[var(--ink-3)]">
              No goals yet. Add some from the Goals tab.
            </div>
          )}
        </div>
      </section>

      {/* reflection */}
      <section className="space-y-3">
        <div className="os-label">Reflect</div>
        <ReflectField label="What worked — keep" value={keep} onChange={setKeep} dot="var(--success)" />
        <ReflectField label="What dragged — cut or shrink" value={cut} onChange={setCut} dot="var(--warn)" />
        <ReflectField label="What's missing — add" value={add} onChange={setAdd} dot="var(--info)" />
      </section>

      {/* voice note */}
      <section>
        <div className="os-label mb-2">Voice memo</div>
        <MiniRecorder />
      </section>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] py-2">
      <div className="text-sm font-mono text-[var(--ink-1)] tabular-nums">{value}</div>
      <div className="os-label">{label}</div>
    </div>
  );
}

function ReflectField({ label, value, onChange, dot }: {
  label: string; value: string; onChange: (v: string) => void; dot: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="dot" style={{ background: dot }} />
        <span className="os-label normal-case tracking-wide">{label}</span>
      </div>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
        placeholder="Write a sentence or two…" />
    </div>
  );
}
