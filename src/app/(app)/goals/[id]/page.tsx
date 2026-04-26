"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Camera,
  Check,
  Edit2,
  FileText,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { db } from "@/lib/db/dexie";
import { getRepo } from "@/lib/repo";
import { useSignedMediaUrl } from "@/lib/media/useSignedMediaUrl";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { DayPicker } from "@/components/ui/DayPicker";
import {
  buildStreakDates,
  computeStreak,
  habitDoneToday,
  isHabitDueToday,
} from "@/lib/engine";
import { LOCAL_USER_ID, cn, todayISO } from "@/lib/utils";
import { nanoid } from "nanoid";
import type { GoalEntry, Habit } from "@/types";
import { useUser } from "@/store/useUser";
import { defaultRamp } from "@/lib/adherence/ramp";

// ─── weekly bar data ──────────────────────────────────────────────────────────

function weekData(habit: Habit, logs: import("@/types").Log[]) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: 8 }).map((_, i) => {
    const ws = addWeeks(weekStart, -7 + i);
    let due = 0;
    let done = 0;
    let totalValue = 0;
    for (let d = 0; d < 7; d++) {
      const day = addDays(ws, d);
      if (day > today) break;
      const ds = day.toISOString().slice(0, 10);
      if (!isHabitDueToday(habit, day)) continue;
      due++;
      const r = habitDoneToday(habit, logs, ds);
      if (r.done) done++;
      totalValue += r.value;
    }
    return {
      week: format(ws, "MMM d"),
      value: habit.kind === "duration" || habit.kind === "count"
        ? totalValue
        : due > 0 ? Math.round((done / due) * 100) : 0,
      target: habit.kind === "duration"
        ? (habit.target ?? 1) * due
        : habit.kind === "count"
          ? (habit.target ?? 1) * due
          : 100,
      due,
      done,
    };
  });
}

// ─── 14-day strip ─────────────────────────────────────────────────────────────

function ConsistencyStrip({ habit, logs }: { habit: Habit; logs: import("@/types").Log[] }) {
  const today = new Date();
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = addDays(today, -13 + i);
    const ds = d.toISOString().slice(0, 10);
    const due = isHabitDueToday(habit, d);
    const r = due ? habitDoneToday(habit, logs, ds) : null;
    return { ds, due, done: r?.done ?? false, future: d > today };
  });

  return (
    <div className="flex gap-1">
      {days.map(({ ds, due, done, future }) => (
        <div
          key={ds}
          title={ds}
          className={cn(
            "flex-1 h-6 rounded-sm",
            future ? "bg-[var(--surface-2)]/50"
              : !due ? "bg-[var(--surface-2)]"
              : done ? "bg-[var(--accent)]"
              : "bg-[var(--danger)]/30"
          )}
        />
      ))}
    </div>
  );
}

// ─── Journal entry card ───────────────────────────────────────────────────────

function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // set in a microtask to avoid the synchronous setState in effect rule
    const t = setTimeout(() => setUrl(u), 0);
    return () => { clearTimeout(t); URL.revokeObjectURL(u); setUrl(""); };
  }, [blob]);
  return url;
}

function EntryCard({ entry }: { entry: GoalEntry }) {
  const blobUrl = useObjectUrl(entry.blob);
  const signedUrl = useSignedMediaUrl(!entry.blob && entry.photoStorageKey ? entry.photoStorageKey : undefined);
  const imgUrl = blobUrl || signedUrl;

  async function del() {
    const repo = await getRepo();
    await repo.deleteGoalEntry(entry.id);
  }

  return (
    <div className="os-block p-3 group space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="os-label text-[var(--ink-3)]">
          {format(parseISO(entry.date), "EEE, d MMM")}
        </span>
        <button
          onClick={del}
          className="opacity-0 group-hover:opacity-100 transition rounded-md p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {entry.text && (
        <p className="text-sm text-[var(--ink-1)] leading-relaxed whitespace-pre-wrap">
          {entry.text}
        </p>
      )}
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt="entry"
          className="w-full rounded-md object-cover max-h-64"
        />
      )}
    </div>
  );
}

// ─── Add entry form ───────────────────────────────────────────────────────────

function AddEntry({ habitId }: { habitId: string }) {
  const [text, setText] = useState("");
  const [blob, setBlob] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useUser((s) => s.user);

  async function save() {
    if (!text.trim() && !blob) return;
    if (!user?.userId) return;
    setSaving(true);
    const repo = await getRepo();
    const t = Date.now();
    await repo.upsertGoalEntry({
      id: nanoid(),
      userId: user.userId,
      habitId,
      date: todayISO(),
      text: text.trim() || undefined,
      blob: blob ?? undefined,
      mimeType: blob?.type,
      createdAt: t,
      updatedAt: t,
    });
    setText("");
    setBlob(null);
    setSaving(false);
  }

  return (
    <div className="os-block p-3 space-y-2">
      <Textarea
        rows={2}
        placeholder="Write a note, reflection, or observation…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {blob && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--ink-2)]">
          <Camera size={11} />
          <span className="truncate flex-1">{blob.name}</span>
          <button onClick={() => setBlob(null)} className="text-[var(--danger)]">
            <X size={11} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="h-8 w-8 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition"
        >
          <Camera size={14} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => setBlob(e.target.files?.[0] ?? null)}
        />
        <Button
          size="sm"
          className="ml-auto"
          loading={saving}
          disabled={!text.trim() && !blob}
          onClick={save}
        >
          Add entry
        </Button>
      </div>
    </div>
  );
}

// ─── Inline edit panel ────────────────────────────────────────────────────────

function EditPanel({
  habit,
  onClose,
}: {
  habit: Habit;
  onClose: () => void;
}) {
  const [title,        setTitle]        = useState(habit.title);
  const [target,       setTarget]       = useState(habit.target ?? 1);
  const [unit,         setUnit]         = useState(habit.unit ?? "");
  const [cue,          setCue]          = useState(habit.cue ?? "");
  const [time,         setTime]         = useState(habit.scheduledTime ?? "");
  const [color,        setColor]        = useState(habit.color ?? "#C9A96E");
  const [customDays,   setCustomDays]   = useState<number[]>(habit.customDays ?? []);
  const [weeklyTarget, setWeeklyTarget] = useState(habit.weeklyTarget ?? 7);
  const [difficulty,   setDifficulty]   = useState<import("@/types").Difficulty>(habit.difficulty ?? 2);
  const [saving,       setSaving]       = useState(false);
  const [rampEnabled, setRampEnabled]   = useState(!!habit.ramp?.enabled);
  const [rampTarget, setRampTarget]     = useState(
    habit.ramp?.targetTime ?? habit.scheduledTime ?? "06:30"
  );
  const [rampStep, setRampStep]         = useState(habit.ramp?.stepMinutes ?? 15);

  const COLORS = [
    "#C9A96E", "#D97757", "#7AA98A", "#6E9BC9", "#A96EC9",
    "#C96E9B", "#9BC96E", "#C9C96E", "#6EC9C9", "#C96E6E",
  ];

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    let ramp: Habit["ramp"] = habit.ramp;
    if (habit.kind === "binary") {
      if (rampEnabled && time) {
        ramp = {
          ...defaultRamp({ targetTime: rampTarget || time, stepMinutes: rampStep }),
          lastAdjustedWeekKey: habit.ramp?.lastAdjustedWeekKey,
          successStreakDays: habit.ramp?.successStreakDays ?? 0,
        };
      } else {
        ramp = undefined;
      }
    }
    await db().habits.update(habit.id, {
      title: title.trim(),
      target,
      unit: unit || undefined,
      cue: cue || undefined,
      scheduledTime: time || undefined,
      color,
      customDays: customDays.length > 0 ? customDays : undefined,
      weeklyTarget: customDays.length > 0 ? customDays.length : weeklyTarget,
      difficulty,
      ramp,
      updatedAt: Date.now(),
    });
    // Update local reminder record
    const existing = await db().reminders.where("habitId").equals(habit.id).first();
    if (time) {
      if (existing) {
        await db().reminders.update(existing.id, { time, updatedAt: Date.now() });
      } else {
        await db().reminders.put({
          id: nanoid(), userId: habit.userId ?? LOCAL_USER_ID,
          habitId: habit.id, time, tone: "coach", enabled: 1,
          createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    } else if (existing) {
      await db().reminders.delete(existing.id);
    }
    // Sync reminder to Supabase so backend cron fires push when app is closed
    const { syncReminder } = await import("@/lib/notifications/syncReminder");
    await syncReminder({
      habitId: habit.id,
      habitTitle: title.trim(),
      remindTime: time,
      days: customDays.length > 0 ? customDays : [0,1,2,3,4,5,6],
    });
    const updated = await db().habits.get(habit.id);
    if (updated) {
      const repo = await getRepo();
      await repo.upsertHabit(updated);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="os-block p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="os-label">Edit goal</span>
        <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink-1)]">
          <X size={16} />
        </button>
      </div>

      <div>
        <Label>Title</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>

      {(habit.kind === "count" || habit.kind === "duration") && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Daily target</Label>
            <Input type="number" min={1} value={target}
              onChange={e => setTarget(Number(e.target.value))} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <Label>Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={cn("h-6 w-6 rounded-md border-2 transition",
                color === c ? "border-[var(--ink-1)] scale-110" : "border-transparent")}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      <div>
        <Label>Cue</Label>
        <Input value={cue} onChange={e => setCue(e.target.value)}
          placeholder="e.g. after morning coffee" />
      </div>

      {/* Day picker — for non-daily habits */}
      {habit.cadence !== "daily" && (
        <DayPicker
          label="Which days?"
          selected={customDays}
          onChange={days => {
            setCustomDays(days);
            setWeeklyTarget(days.length);
          }}
          single={habit.cadence === "weekly"}
        />
      )}

      <div>
        <Label>Reminder time</Label>
        <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
      </div>

      {habit.kind === "binary" && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-3 bg-[var(--surface-2)]/40">
          <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
            <input
              type="checkbox"
              checked={rampEnabled}
              onChange={(e) => setRampEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Progressive target (e.g. wake −15m / week)
          </label>
          {rampEnabled && (
            <>
              <div>
                <Label>Target anchor (final)</Label>
                <Input
                  type="time"
                  value={rampTarget}
                  onChange={(e) => setRampTarget(e.target.value)}
                />
              </div>
              <div>
                <Label>Step (minutes earlier per week)</Label>
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={rampStep}
                  onChange={(e) => setRampStep(Number(e.target.value) || 15)}
                />
              </div>
              {rampStep > 15 && (
                <p className="text-[11px] text-[var(--warn)] leading-relaxed">
                  Large weekly shifts can be hard on sleep rhythm. Many coaches use 10–15 minutes per week — adjust if
                  this feels like too much.
                </p>
              )}
              <p className="text-[10px] font-mono text-[var(--ink-3)] leading-relaxed">
                Each Monday week you’ll be asked to accept the next step or snooze. Not medical advice — you stay in
                control.
              </p>
            </>
          )}
        </div>
      )}

      <div>
        <Label>Difficulty</Label>
        <div className="flex gap-1">
          {([1, 2, 3, 4, 5] as import("@/types").Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={cn(
                "flex-1 h-9 rounded-md border text-xs font-mono transition",
                difficulty === d
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-3)]"
              )}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-0.5 text-[10px] font-mono text-[var(--ink-3)]">
          <span>easy</span><span>brutal</span>
        </div>
      </div>

      <Button size="sm" className="w-full" onClick={save} loading={saving} disabled={!title.trim()}>
        <Check size={14} /> Save changes
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const repo = await getRepo();
        await repo.listGoalEntries({ habitId: id });
      } catch {
        /* offline */
      }
    })();
  }, [id]);

  const habit   = useLiveQuery(() => db().habits.get(id), [id]);
  const allLogs = useLiveQuery(() => db().logs.toArray(), []);
  const entries = useLiveQuery(
    () =>
      db()
        .goalEntries.where("habitId")
        .equals(id)
        .reverse()
        .sortBy("createdAt"),
    [id]
  );

  const color = habit?.color ?? "var(--accent)";
  const today = todayISO();

  const chartData = useMemo(() => {
    if (!habit || !allLogs) return [];
    return weekData(habit, allLogs);
  }, [habit, allLogs]);

  const { streakDays, todayValue, todayDone, weekDue, weekDone } = useMemo(() => {
    if (!habit || !allLogs) return { streakDays: 0, todayValue: 0, todayDone: false, weekDue: 0, weekDone: 0 };
    const activeDates = buildStreakDates([habit], allLogs);
    const streak = computeStreak(activeDates, today);
    const { value, done } = habitDoneToday(habit, allLogs, today);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    let due = 0, doneW = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      if (d > new Date()) break;
      const ds = d.toISOString().slice(0, 10);
      if (!isHabitDueToday(habit, d)) continue;
      due++;
      if (habitDoneToday(habit, allLogs, ds).done) doneW++;
    }
    return { streakDays: streak, todayValue: value, todayDone: done, weekDue: due, weekDone: doneW };
  }, [habit, allLogs, today]);

  const isUnit = habit?.kind === "count" || habit?.kind === "duration";

  async function deleteGoal() {
    if (!confirm("Delete this goal and all its logs?")) return;
    await db().habits.update(id, { archived: 1, updatedAt: Date.now() });
    router.replace("/goals");
  }

  if (!habit) return (
    <div className="px-5 pt-6 pb-10 space-y-4">
      <div className="skeleton h-8 w-40 rounded-lg" />
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-14 rounded-2xl" />
      <div className="skeleton h-44 rounded-2xl" />
    </div>
  );

  return (
    <div className="pt-6 pb-10 space-y-6">
      {/* header */}
      <div className="px-5 flex items-center gap-2">
        <Link href="/goals" className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
          <div className="min-w-0">
            <div className="os-label">{(habit as Habit & { area?: string }).area ?? "goal"}</div>
            <h1 className="serif text-2xl text-[var(--ink-1)] truncate -mt-0.5">{habit.title}</h1>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="rounded-md p-2 text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--accent)]"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={deleteGoal}
          className="rounded-md p-2 text-[var(--ink-3)] hover:bg-[var(--surface)] hover:text-[var(--danger)]"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* inline edit */}
      {editing && (
        <div className="px-5">
          <EditPanel habit={habit} onClose={() => setEditing(false)} />
        </div>
      )}

      {/* stats block */}
      <div className="px-5">
        <div className="os-block-strong p-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCell
              label="Today"
              value={todayDone ? (isUnit ? String(Math.round(todayValue)) : "✓") : "—"}
              highlight={todayDone}
            />
            <StatCell
              label="This week"
              value={`${weekDone}/${weekDue}`}
              highlight={weekDue > 0 && weekDone === weekDue}
            />
            <StatCell
              label="Streak"
              value={`${streakDays}d`}
              highlight={streakDays >= 3}
            />
          </div>

          {/* weekly target bar */}
          {(() => {
            const wTarget = habit.weeklyTarget ??
              (habit.cadence === "daily" ? 7 : habit.cadence === "alt-days" ? 4 : habit.cadence === "weekly" ? 1 : weekDue);
            const wPct = wTarget > 0 ? weekDone / wTarget : 0;
            return wTarget > 0 ? (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] os-label mb-1.5">
                  <span>Weekly completion</span>
                  <span className="font-mono text-[var(--ink-2)] tracking-normal normal-case">
                    {weekDone} / {wTarget} days
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.min(1, wPct) * 100}%`, background: color }}
                  />
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {/* 14-day consistency */}
      <div className="px-5">
        <div className="os-label mb-2">14-day consistency</div>
        {allLogs && <ConsistencyStrip habit={habit} logs={allLogs} />}
        <div className="flex justify-between text-[10px] font-mono text-[var(--ink-3)] mt-1">
          <span>14 days ago</span>
          <span>today</span>
        </div>
      </div>

      {/* 8-week chart */}
      <div className="px-5">
        <div className="os-label mb-2">
          {isUnit ? `8-week total ${habit.unit ?? ""}` : "8-week completion %"}
        </div>
        <div className="os-block p-3 h-44">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="week" tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 8, fontSize: 12, color: "var(--ink-1)",
                }}
                cursor={{ fill: "var(--surface-2)" }}
                formatter={(v) =>
                  isUnit ? [v, habit.unit ?? ""] : [`${v}%`, "completion"]
                }
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} fill={color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* detail row */}
      <div className="px-5">
        <div className="os-block divide-y divide-[var(--border)]">
          <Row label="Cadence" value={habit.cadence} />
          {habit.cue && <Row label="Cue" value={habit.cue} />}
          {habit.scheduledTime && <Row label="Time" value={habit.scheduledTime} />}
          {isUnit && (
            <Row
              label="Target"
              value={`${habit.target}${habit.unit ? " " + habit.unit : ""} ${habit.targetMode}`}
            />
          )}
          {habit.kind === "checklist" && habit.steps && (
            <Row label="Steps" value={habit.steps.join(" · ")} />
          )}
        </div>
      </div>

      {/* focus CTA — duration goals only (Pomodoro credits time); count/binary use steppers */}
      {habit.kind === "duration" && (
        <div className="px-5">
          <Link href={`/focus?goalId=${habit.id}`}>
            <Button size="lg" className="w-full">
              <Play size={16} /> Start focus session
            </Button>
          </Link>
        </div>
      )}

      {/* journal */}
      <div className="px-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--accent)]" />
          <div className="os-label">Journal</div>
        </div>
        <AddEntry habitId={id} />
        <div className="space-y-2">
          {(entries ?? []).filter(e => !e.deletedAt).map(e => (
            <EntryCard key={e.id} entry={e} />
          ))}
          {(entries ?? []).length === 0 && (
            <p className="text-[12px] text-[var(--ink-3)] text-center py-2">
              No entries yet — add a note or photo above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={cn("text-xl font-mono tabular-nums", highlight ? "text-[var(--accent)]" : "text-[var(--ink-1)]")}>
        {value}
      </div>
      <div className="os-label mt-0.5">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className="os-label w-16 shrink-0 mt-0.5">{label}</div>
      <div className="text-sm text-[var(--ink-1)] flex-1">{value}</div>
    </div>
  );
}
