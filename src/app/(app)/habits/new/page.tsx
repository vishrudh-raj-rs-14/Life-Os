"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { ArrowLeft, Check, ListChecks, Plus, Timer, X } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { LOCAL_USER_ID } from "@/lib/utils";
import type { Cadence, Difficulty, HabitKind, TargetMode } from "@/types";
import { cn } from "@/lib/utils";

const CADENCES: { value: Cadence; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "alt-days", label: "Alt days" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const KINDS: Array<{
  kind: HabitKind;
  title: string;
  hint: string;
  Icon: React.ComponentType<{ size?: number }>;
  defaultUnit?: string;
  defaultTarget: number;
}> = [
  {
    kind: "binary",
    title: "Just do it",
    hint: "Done / not done. e.g. wake up by 6.",
    Icon: Check,
    defaultTarget: 1,
  },
  {
    kind: "count",
    title: "Hit a number",
    hint: "Quantity. e.g. 10 pages, 2 problems.",
    Icon: Plus,
    defaultUnit: "reps",
    defaultTarget: 10,
  },
  {
    kind: "duration",
    title: "Spend time",
    hint: "Minutes. Auto-credited from focus sessions.",
    Icon: Timer,
    defaultUnit: "min",
    defaultTarget: 30,
  },
  {
    kind: "checklist",
    title: "Run a routine",
    hint: "Multi-step. e.g. morning routine.",
    Icon: ListChecks,
    defaultTarget: 4,
  },
];

function NewHabitInner() {
  const router = useRouter();
  const params = useSearchParams();
  const presetGoalId = params.get("goalId") ?? "";

  const [kind, setKind] = useState<HabitKind>("binary");
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState(presetGoalId);
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("08:30");
  const [cue, setCue] = useState("");
  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("at-least");
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [difficulty, setDifficulty] = useState<Difficulty>(2);

  const meta = useMemo(() => KINDS.find((k) => k.kind === kind)!, [kind]);

  const goals = useLiveQuery(
    () => db().goals.filter((g) => !g.archived && !g.deletedAt).toArray(),
    []
  );

  function pickKind(k: HabitKind) {
    const m = KINDS.find((x) => x.kind === k)!;
    setKind(k);
    setTarget(m.defaultTarget);
    setUnit(m.defaultUnit ?? "");
  }

  async function save() {
    if (!title.trim()) return;
    const id = nanoid();
    const t = Date.now();
    const cleanedSteps =
      kind === "checklist"
        ? steps.map((s) => s.trim()).filter(Boolean)
        : undefined;
    const finalTarget =
      kind === "checklist" ? Math.max(1, cleanedSteps?.length ?? 1) : target;
    await db().habits.add({
      id,
      userId: LOCAL_USER_ID,
      goalId: goalId || undefined,
      title: title.trim(),
      kind,
      unit: kind === "binary" || kind === "checklist" ? undefined : unit || undefined,
      target: finalTarget,
      targetMode,
      steps: cleanedSteps,
      cadence,
      customDays: cadence === "custom" ? customDays : undefined,
      cue: cue || undefined,
      scheduledTime: time || undefined,
      difficulty,
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
    router.replace(goalId ? `/goals/${goalId}` : "/");
  }

  function toggleDay(d: number) {
    setCustomDays((s) =>
      s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()
    );
  }

  function updateStep(i: number, v: string) {
    setSteps((s) => s.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={goalId ? `/goals/${goalId}` : "/"} className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="os-label">Compose</div>
          <h1 className="serif text-2xl text-[var(--ink-1)]">New habit</h1>
        </div>
      </div>

      <div>
        <Label>Habit kind</Label>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map(({ kind: k, title: t, hint, Icon }) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              className={cn(
                "os-block p-3 text-left transition",
                kind === k && "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5 text-[var(--accent)]">
                <Icon size={14} />
                <span className="text-sm font-medium text-[var(--ink-1)]">
                  {t}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-3)] leading-snug">{hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            placeholder="e.g. Read engineering blog"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <Label>Linked goal</Label>
          <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">— none —</option>
            {(goals ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </div>

        {kind !== "binary" && kind !== "checklist" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Daily target</Label>
              <Input
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                placeholder={meta.defaultUnit ?? "unit"}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
        )}

        {kind === "checklist" && (
          <div>
            <Label>Steps</Label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono text-[var(--ink-3)] text-xs w-5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Input
                    placeholder={`Step ${i + 1}`}
                    value={s}
                    onChange={(e) => updateStep(i, e.target.value)}
                  />
                  {steps.length > 1 && (
                    <button
                      onClick={() =>
                        setSteps((cur) => cur.filter((_, idx) => idx !== i))
                      }
                      className="h-9 w-9 rounded-md border border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--warn)] flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSteps((s) => [...s, ""])}
              >
                <Plus size={14} /> add step
              </Button>
            </div>
          </div>
        )}

        {kind !== "binary" && kind !== "checklist" && (
          <div>
            <Label>Target mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["at-least", "exactly", "at-most"] as TargetMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setTargetMode(m)}
                  className={cn(
                    "h-10 rounded-md border text-xs font-mono",
                    targetMode === m
                      ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)]"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Cadence</Label>
          <div className="grid grid-cols-4 gap-2">
            {CADENCES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCadence(c.value)}
                className={cn(
                  "h-10 rounded-md border text-xs font-mono",
                  cadence === c.value
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-2)]"
                )}
              >
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
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "flex-1 h-10 rounded-md text-xs font-medium border font-mono",
                    customDays.includes(i)
                      ? "bg-[var(--accent)]/[0.1] border-[var(--accent)]/60 text-[var(--accent)]"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--ink-3)]"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Cue (when / where)</Label>
          <Input
            placeholder="e.g. Right after morning coffee"
            value={cue}
            onChange={(e) => setCue(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <Label>Difficulty</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d as Difficulty)}
                  className={cn(
                    "flex-1 h-11 rounded-md border text-sm font-mono",
                    difficulty === d
                      ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-3)]"
                  )}
                >
                  {"●".repeat(d)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button size="lg" className="w-full" onClick={save}>
          Create habit
        </Button>
      </div>
    </div>
  );
}

export default function NewHabitPage() {
  return (
    <Suspense>
      <NewHabitInner />
    </Suspense>
  );
}
