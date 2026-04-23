"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { Camera, LineChart, Plus, Smile, Trash2 } from "lucide-react";
import type { Tracker, TrackerKind } from "@/types";
import { db } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LOCAL_USER_ID, nowMs, todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  TrackerKind,
  { label: string; Icon: React.ComponentType<{ size?: number }>; hint: string }
> = {
  photo: { label: "Photo", Icon: Camera, hint: "Visual proof. Stored locally." },
  measurement: {
    label: "Measurement",
    Icon: LineChart,
    hint: "Weight, body fat, run pace, anything numeric.",
  },
  mood: { label: "Mood", Icon: Smile, hint: "1–5 scale per day." },
  custom: { label: "Custom", Icon: LineChart, hint: "Anything you want to log." },
};

export function TrackerSection({ goalId }: { goalId: string }) {
  const trackers = useLiveQuery(
    () =>
      db()
        .trackers.filter((t) => t.goalId === goalId && !t.archived)
        .toArray(),
    [goalId]
  );
  const [composing, setComposing] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="os-label">Trackers</div>
          <p className="text-[11px] text-[var(--ink-3)]">
            Specialized data the goal needs (photos, measurements, mood…).
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setComposing((v) => !v)}
        >
          <Plus size={14} /> add
        </Button>
      </div>

      {composing && (
        <NewTrackerForm
          goalId={goalId}
          onCancel={() => setComposing(false)}
          onCreated={() => setComposing(false)}
        />
      )}

      {trackers && trackers.length > 0 ? (
        <div className="space-y-2">
          {trackers.map((t) => (
            <TrackerCard key={t.id} tracker={t} />
          ))}
        </div>
      ) : (
        !composing && (
          <div className="os-block px-3 py-3 text-[12px] text-[var(--ink-3)]">
            No trackers yet. Add a progress photo, weight log, mood scale, or
            anything custom.
          </div>
        )
      )}
    </div>
  );
}

function NewTrackerForm({
  goalId,
  onCreated,
  onCancel,
}: {
  goalId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<TrackerKind>("measurement");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  async function save() {
    if (!name.trim()) return;
    const t = nowMs();
    const tracker: Tracker = {
      id: nanoid(),
      userId: LOCAL_USER_ID,
      goalId,
      kind,
      name: name.trim(),
      unit: unit.trim() || undefined,
      cadence: "weekly",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    };
    await db().trackers.add(tracker);
    onCreated();
  }

  return (
    <div className="os-block p-3 space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(KIND_META) as TrackerKind[]).map((k) => {
          const M = KIND_META[k];
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "h-12 rounded-md border text-[11px] font-mono flex flex-col items-center justify-center gap-0.5",
                kind === k
                  ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.08] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)]"
              )}
            >
              <M.Icon size={14} />
              {M.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input
          className="col-span-2"
          placeholder="Tracker name (e.g. Body weight)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder={kind === "mood" ? "1–5" : "unit"}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          cancel
        </Button>
        <Button size="sm" onClick={save}>
          add
        </Button>
      </div>
    </div>
  );
}

function TrackerCard({ tracker }: { tracker: Tracker }) {
  const entries = useLiveQuery(
    () =>
      db()
        .trackerEntries.filter(
          (e) => e.trackerId === tracker.id && !e.deletedAt
        )
        .reverse()
        .sortBy("date"),
    [tracker.id]
  );
  const M = KIND_META[tracker.kind];
  return (
    <div className="os-block p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent)]">
            <M.Icon size={14} />
          </span>
          <span className="text-sm font-medium">{tracker.name}</span>
          <span className="os-label">{tracker.kind}</span>
        </div>
        <button
          onClick={async () => {
            if (!confirm("Delete tracker?")) return;
            await db().trackers.delete(tracker.id);
          }}
          className="text-[var(--ink-3)] hover:text-[var(--warn)]"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <NewEntryForm tracker={tracker} />

      {entries && entries.length > 0 && (
        <div className="mt-3">
          {tracker.kind === "photo" ? (
            <PhotoStrip entries={entries} />
          ) : (
            <EntryList tracker={tracker} entries={entries} />
          )}
        </div>
      )}
    </div>
  );
}

function NewEntryForm({ tracker }: { tracker: Tracker }) {
  const [val, setVal] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  async function save() {
    const t = nowMs();
    if (tracker.kind === "photo" && !photo) return;
    if (tracker.kind !== "photo" && !val && !text) return;
    await db().trackerEntries.add({
      id: nanoid(),
      userId: LOCAL_USER_ID,
      trackerId: tracker.id,
      date: todayISO(),
      value: val ? Number(val) : undefined,
      text: text || undefined,
      photo: photo ?? undefined,
      createdAt: t,
      updatedAt: t,
    });
    setVal("");
    setText("");
    setPhoto(null);
  }

  if (tracker.kind === "photo") {
    return (
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <span
            className={cn(
              "block w-full h-10 rounded-md border border-dashed text-xs flex items-center justify-center font-mono cursor-pointer",
              photo
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--ink-3)]"
            )}
          >
            {photo ? photo.name : "tap to capture"}
          </span>
        </label>
        <Button size="sm" onClick={save} disabled={!photo}>
          log
        </Button>
      </div>
    );
  }

  if (tracker.kind === "mood") {
    return (
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={async () => {
              const t = nowMs();
              await db().trackerEntries.add({
                id: nanoid(),
                userId: LOCAL_USER_ID,
                trackerId: tracker.id,
                date: todayISO(),
                value: n,
                createdAt: t,
                updatedAt: t,
              });
            }}
            className="flex-1 h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] font-mono text-xs"
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Input
        className="col-span-1"
        type="number"
        step="0.1"
        placeholder={tracker.unit ?? "value"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <Input
        className="col-span-2"
        placeholder="notes (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
    </div>
  );
}

function EntryList({
  tracker,
  entries,
}: {
  tracker: Tracker;
  entries: Array<{ id: string; date: string; value?: number; text?: string }>;
}) {
  const recent = entries.slice(0, 6);
  return (
    <div className="space-y-1">
      {recent.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-between text-[12px] font-mono py-1 border-t border-[var(--border)] first:border-t-0"
        >
          <span className="text-[var(--ink-3)]">{e.date}</span>
          <span className="text-[var(--ink-1)]">
            {e.value !== undefined && (
              <span>
                {e.value}
                {tracker.unit ? ` ${tracker.unit}` : ""}
              </span>
            )}
            {e.text && (
              <span className="text-[var(--ink-2)] ml-2">· {e.text}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhotoStrip({
  entries,
}: {
  entries: Array<{ id: string; date: string; photo?: Blob }>;
}) {
  const withPhotos = entries.filter((e) => e.photo);
  if (withPhotos.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
      {withPhotos.slice(0, 12).map((e) => (
        <PhotoTile key={e.id} blob={e.photo!} date={e.date} />
      ))}
    </div>
  );
}

function PhotoTile({ blob, date }: { blob: Blob; date: string }) {
  const url = useObjectUrl(blob);
  return (
    <div className="shrink-0 w-20 h-28 rounded-md overflow-hidden border border-[var(--border)] relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={date} className="w-full h-full object-cover" />
      <div className="absolute bottom-0 inset-x-0 text-[9px] font-mono text-[var(--ink-1)] bg-black/60 px-1 py-0.5 text-center">
        {date}
      </div>
    </div>
  );
}

function useObjectUrl(blob: Blob): string {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}
