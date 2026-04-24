"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { ArrowLeft, Check, ListChecks, Plus, Timer, X } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { LOCAL_USER_ID, cn } from "@/lib/utils";
import type { Cadence, Difficulty, HabitKind, LifeArea, TargetMode } from "@/types";

const COLORS = [
  "#C9A96E", "#D97757", "#7AA98A", "#6E9BC9", "#A96EC9",
  "#C96E9B", "#9BC96E", "#C9C96E", "#6EC9C9", "#C96E6E",
];

const AREAS: { value: LifeArea; label: string }[] = [
  { value: "career", label: "Career" },
  { value: "health", label: "Health" },
  { value: "mind", label: "Mind" },
  { value: "wealth", label: "Wealth" },
  { value: "craft", label: "Craft" },
  { value: "relationships", label: "Relationships" },
  { value: "lifestyle", label: "Lifestyle" },
];

const KINDS: { kind: HabitKind; label: string; hint: string; Icon: React.ComponentType<{size?: number; className?: string}> }[] = [
  { kind: "binary",    label: "Did it",    hint: "Done / not done", Icon: Check },
  { kind: "count",     label: "Hit a number", hint: "Track quantity", Icon: Plus },
  { kind: "duration",  label: "Spend time", hint: "Track minutes",  Icon: Timer },
  { kind: "checklist", label: "Routine",   hint: "Multi-step list", Icon: ListChecks },
];

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "daily",    label: "Daily" },
  { value: "alt-days", label: "Alt days" },
  { value: "weekly",   label: "Weekly" },
  { value: "custom",   label: "Custom" },
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function NewGoalPage() {
  const router = useRouter();

  const [title,      setTitle]      = useState("");
  const [area,       setArea]       = useState<LifeArea>("career");
  const [color,      setColor]      = useState(COLORS[0]);
  const [kind,       setKind]       = useState<HabitKind>("binary");
  const [target,     setTarget]     = useState(1);
  const [unit,       setUnit]       = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("at-least");
  const [steps,      setSteps]      = useState<string[]>(["", ""]);
  const [cadence,    setCadence]    = useState<Cadence>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);
  const [cue,        setCue]        = useState("");
  const [time,       setTime]       = useState("");
  const [difficulty, setDifficulty]   = useState<Difficulty>(2);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(7);
  const [saving,     setSaving]     = useState(false);

  function pickKind(k: HabitKind) {
    setKind(k);
    if (k === "binary")    { setTarget(1);  setUnit(""); }
    if (k === "count")     { setTarget(10); setUnit("reps"); }
    if (k === "duration")  { setTarget(30); setUnit("min"); }
    if (k === "checklist") { setTarget(2);  setUnit(""); }
  }

  function pickCadence(c: Cadence) {
    setCadence(c);
    // auto-set sensible weeklyTarget when cadence changes
    if (c === "daily")    setWeeklyTarget(7);
    if (c === "alt-days") setWeeklyTarget(4);
    if (c === "weekly")   setWeeklyTarget(1);
  }

  function toggleDay(d: number) {
    setCustomDays(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d].sort());
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const t = Date.now();
    const id = nanoid();
    const cleanedSteps = kind === "checklist"
      ? steps.map(s => s.trim()).filter(Boolean) : undefined;
    const finalTarget = kind === "checklist"
      ? Math.max(1, cleanedSteps?.length ?? 1) : target;

    await db().habits.add({
      id,
      userId: LOCAL_USER_ID,
      title: title.trim(),
      color,
      kind,
      unit: (kind === "binary" || kind === "checklist") ? undefined : (unit || undefined),
      target: finalTarget,
      targetMode,
      steps: cleanedSteps,
      cadence,
      customDays: cadence === "custom" ? customDays : undefined,
      cue: cue || undefined,
      scheduledTime: time || undefined,
      difficulty,
      weeklyTarget,
      area,
      archived: 0,
      createdAt: t,
      updatedAt: t,
    });

    if (time) {
      await db().reminders.put({
        id: nanoid(),
        userId: LOCAL_USER_ID,
        habitId: id,
        time,
        tone: "coach",
        enabled: 1,
        createdAt: t,
        updatedAt: t,
      });
    }

    router.replace(`/goals/${id}`);
  }

  return (
    <div className="px-5 pt-6 pb-32 space-y-6">
      {/* header */}
      <div className="flex items-center gap-2">
        <Link href="/goals" className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="os-label">New goal</div>
          <h1 className="serif text-2xl text-[var(--ink-1)]">Add a new goal</h1>
        </div>
      </div>

      {/* title */}
      <div>
        <Label>Goal title</Label>
        <Input
          autoFocus
          placeholder="e.g. Wake up by 6 AM"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      {/* area */}
      <div>
        <Label>Life area</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {AREAS.map(a => (
            <button
              key={a.value}
              onClick={() => setArea(a.value)}
              className={cn(
                "h-10 rounded-md border text-[11px] font-mono transition",
                area === a.value
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-3)]"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* color */}
      <div>
        <Label>Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-md border-2 transition",
                color === c ? "border-[var(--ink-1)] scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* kind */}
      <div>
        <Label>Measure</Label>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map(({ kind: k, label, hint, Icon }) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              className={cn(
                "os-block p-3 text-left transition",
                kind === k && "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={13} className={kind === k ? "text-[var(--accent)]" : "text-[var(--ink-3)]"} />
                <span className="text-sm font-medium text-[var(--ink-1)]">{label}</span>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">{hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* target + unit (count/duration only) */}
      {kind !== "binary" && kind !== "checklist" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Daily target</Label>
            <Input type="number" min={1} value={target}
              onChange={e => setTarget(Number(e.target.value))} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input placeholder={kind === "duration" ? "min" : "reps"}
              value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
      )}

      {/* target mode (count/duration only) */}
      {kind !== "binary" && kind !== "checklist" && (
        <div>
          <Label>Mode</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["at-least", "exactly", "at-most"] as TargetMode[]).map(m => (
              <button key={m} onClick={() => setTargetMode(m)}
                className={cn(
                  "h-10 rounded-md border text-xs font-mono",
                  targetMode === m
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)]"
                )}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* checklist steps */}
      {kind === "checklist" && (
        <div>
          <Label>Steps</Label>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-[var(--ink-3)] text-xs w-5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Input placeholder={`Step ${i + 1}`} value={s}
                  onChange={e => setSteps(cur => cur.map((x, idx) => idx === i ? e.target.value : x))} />
                {steps.length > 1 && (
                  <button onClick={() => setSteps(cur => cur.filter((_, idx) => idx !== i))}
                    className="h-9 w-9 rounded-md border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--warn)] flex items-center justify-center">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setSteps(s => [...s, ""])}>
              <Plus size={14} /> add step
            </Button>
          </div>
        </div>
      )}

      {/* cadence */}
      <div>
        <Label>Cadence</Label>
        <div className="grid grid-cols-4 gap-2">
          {CADENCES.map(c => (
            <button key={c.value} onClick={() => pickCadence(c.value)}
              className={cn(
                "h-10 rounded-md border text-xs font-mono",
                cadence === c.value
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)]"
              )}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {cadence === "custom" && (
        <div>
          <Label>Days</Label>
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                className={cn(
                  "flex-1 h-10 rounded-md text-xs font-mono border",
                  customDays.includes(i)
                    ? "bg-[var(--accent)]/[0.1] border-[var(--accent)]/60 text-[var(--accent)]"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-3)]"
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* cue + time */}
      <div>
        <Label>Cue (when / where)</Label>
        <Input placeholder="e.g. Right after morning coffee" value={cue}
          onChange={e => setCue(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Reminder time</Label>
          <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <Label>Weekly target (days)</Label>
          <Input
            type="number" min={1} max={7}
            value={weeklyTarget}
            onChange={e => setWeeklyTarget(Math.min(7, Math.max(1, Number(e.target.value))))}
          />
        </div>
      </div>

      <div>
        <Label>Difficulty</Label>
        <div className="flex gap-1.5">
          {([1, 2, 3, 4, 5] as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={cn(
                "flex-1 h-11 rounded-md border text-xs font-mono",
                difficulty === d
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-3)]"
              )}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-mono text-[var(--ink-3)]">
          <span>easy</span><span>brutal</span>
        </div>
      </div>

      {/* save */}
      <Button
        size="lg"
        className="w-full"
        loading={saving}
        disabled={!title.trim()}
        onClick={save}
      >
        Create goal
      </Button>
    </div>
  );
}
