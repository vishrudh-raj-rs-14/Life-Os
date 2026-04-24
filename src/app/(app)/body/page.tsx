"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { format, parseISO, subDays } from "date-fns";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Camera, TrendingDown, TrendingUp, Minus, Trash2, X } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { LOCAL_USER_ID, cn, todayISO } from "@/lib/utils";
import type { BodyLog } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function usePhotoUrl(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const t = setTimeout(() => setUrl(u), 0);
    return () => { clearTimeout(t); URL.revokeObjectURL(u); setUrl(""); };
  }, [blob]);
  return url;
}

// ─── Add entry form ───────────────────────────────────────────────────────────

function AddEntry({ onSaved }: { onSaved: () => void }) {
  const [weight, setWeight] = useState("");
  const [notes,  setNotes]  = useState("");
  const [photo,  setPhoto]  = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  async function save() {
    if (!weight && !photo) return;
    setSaving(true);
    // upsert by date — one log per day
    const existing = await db().bodyLogs
      .where("date").equals(today)
      .filter(l => l.userId === LOCAL_USER_ID)
      .first();

    const data: Partial<BodyLog> = {
      weight: weight ? parseFloat(weight) : undefined,
      notes: notes || undefined,
      blob: photo ?? undefined,
      mimeType: photo?.type,
      updatedAt: Date.now(),
    };
    if (existing) {
      await db().bodyLogs.update(existing.id, data);
    } else {
      await db().bodyLogs.add({
        id: nanoid(),
        userId: LOCAL_USER_ID,
        date: today,
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as BodyLog);
    }
    setWeight(""); setNotes(""); setPhoto(null);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="os-block p-4 space-y-3">
      <div className="os-label">Today — {format(new Date(), "EEE d MMM")}</div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Weight (kg)</Label>
          <Input type="number" step="0.1" placeholder="72.5"
            value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end">
          <button
            onClick={() => fileRef.current?.click()}
            className={cn(
              "h-11 rounded-md border flex items-center justify-center gap-2 text-sm transition",
              photo
                ? "border-[var(--accent)]/60 text-[var(--accent)] bg-[var(--accent)]/[0.06]"
                : "border-[var(--border)] text-[var(--ink-3)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40"
            )}
          >
            <Camera size={16} />
            {photo ? "Photo ✓" : "Photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      {photo && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--ink-2)]">
          <span className="flex-1 truncate">{photo.name}</span>
          <button onClick={() => setPhoto(null)} className="text-[var(--danger)]">
            <X size={12} />
          </button>
        </div>
      )}

      <Button size="sm" className="w-full" disabled={(!weight && !photo) || saving} onClick={save}>
        {saving ? "Saving…" : "Log today"}
      </Button>
    </div>
  );
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ log, onDelete }: { log: BodyLog; onDelete: () => void }) {
  const url = usePhotoUrl(log.blob);
  const [big, setBig] = useState(false);

  return (
    <>
      <div
        className="relative aspect-square rounded-md overflow-hidden bg-[var(--surface-2)] cursor-pointer group"
        onClick={() => setBig(true)}
      >
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={log.date} className="w-full h-full object-cover" />
          : <div className="flex items-center justify-center h-full text-[var(--ink-3)]"><Camera size={18} /></div>
        }
        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-[9px] text-white font-mono px-1 py-0.5">
          {format(parseISO(log.date), "d MMM")}
          {log.weight && <span className="ml-1">{log.weight}kg</span>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-black/60 rounded-full p-1"
        >
          <Trash2 size={10} className="text-white" />
        </button>
      </div>

      {/* fullscreen modal */}
      {big && url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setBig(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={24} />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function BodySkeleton() {
  return (
    <div className="px-5 pt-6 pb-10 space-y-4">
      <div className="skeleton h-8 w-24 rounded-lg" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-20 rounded-2xl" />
      <div className="skeleton h-48 rounded-2xl" />
    </div>
  );
}

export default function BodyPage() {
  const [refresh, setRefresh] = useState(0);

  const logs = useLiveQuery(
    () =>
      db()
        .bodyLogs.where("userId")
        .equals(LOCAL_USER_ID)
        .reverse()
        .sortBy("date"),
    [refresh]
  );

  // Chart data — last 60 days with weight entries
  const chartData = useMemo(() => {
    if (!logs) return [];
    return [...logs]
      .filter(l => l.weight != null)
      .reverse()
      .slice(-60)
      .map(l => ({ date: format(parseISO(l.date), "d MMM"), weight: l.weight! }));
  }, [logs]);

  // Stats
  const stats = useMemo(() => {
    const withWeight = (logs ?? []).filter(l => l.weight != null);
    if (withWeight.length < 2) return null;
    const latest  = withWeight[0].weight!;
    const prev7   = withWeight.find(l => l.date <= format(subDays(new Date(), 7), "yyyy-MM-dd"));
    const prev30  = withWeight.find(l => l.date <= format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const change7  = prev7  ? latest - prev7.weight!  : null;
    const change30 = prev30 ? latest - prev30.weight! : null;
    return { latest, change7, change30 };
  }, [logs]);

  const photos = useMemo(
    () => (logs ?? []).filter(l => l.blob).slice(0, 30),
    [logs]
  );

  async function deleteLog(id: string) {
    await db().bodyLogs.delete(id);
  }

  if (logs === undefined) return <BodySkeleton />;

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="os-label">Daily tracking</div>
        <h1 className="serif text-3xl text-[var(--ink-1)]">Body</h1>
      </motion.div>

      {/* log today */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <AddEntry onSaved={() => setRefresh(r => r + 1)} />
      </motion.div>

      {/* current stats */}
      {stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="os-block-strong p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="serif text-2xl text-[var(--ink-1)]">{stats.latest}</div>
            <div className="os-label">kg now</div>
          </div>
          <div>
            {stats.change7 !== null ? (
              <>
                <div className={cn("serif text-2xl flex items-center justify-center gap-1",
                  stats.change7 < 0 ? "text-[var(--success)]" : stats.change7 > 0 ? "text-[var(--danger)]" : "text-[var(--ink-2)]"
                )}>
                  {stats.change7 < 0 ? <TrendingDown size={16} /> : stats.change7 > 0 ? <TrendingUp size={16} /> : <Minus size={16} />}
                  {stats.change7 > 0 ? "+" : ""}{stats.change7.toFixed(1)}
                </div>
                <div className="os-label">7-day</div>
              </>
            ) : <div className="os-label">no 7d data</div>}
          </div>
          <div>
            {stats.change30 !== null ? (
              <>
                <div className={cn("serif text-2xl flex items-center justify-center gap-1",
                  stats.change30 < 0 ? "text-[var(--success)]" : stats.change30 > 0 ? "text-[var(--danger)]" : "text-[var(--ink-2)]"
                )}>
                  {stats.change30 > 0 ? "+" : ""}{stats.change30.toFixed(1)}
                </div>
                <div className="os-label">30-day</div>
              </>
            ) : <div className="os-label">no 30d data</div>}
          </div>
        </motion.div>
      )}

      {/* weight chart */}
      {chartData.length > 1 && (
        <div>
          <div className="os-label mb-2">Weight trend</div>
          <div className="os-block p-3 h-48">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                  tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                  tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 8, fontSize: 12, color: "var(--ink-1)",
                  }}
                  formatter={(v) => [`${v} kg`, "Weight"]}
                />
                <Area type="monotone" dataKey="weight" stroke="var(--accent)"
                  strokeWidth={2} fill="url(#wGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* progress photos */}
      {photos.length > 0 && (
        <div>
          <div className="os-label mb-2">Progress photos</div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(log => (
              <PhotoThumb key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
            ))}
          </div>
        </div>
      )}

      {/* recent log entries */}
      {(logs ?? []).length > 0 && (
        <div>
          <div className="os-label mb-2">History</div>
          <div className="space-y-1">
            {(logs ?? []).slice(0, 20).map(log => (
              <div key={log.id}
                className="os-block px-3 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--ink-3)] text-[11px]">
                    {format(parseISO(log.date), "EEE d MMM")}
                  </span>
                  {log.weight && (
                    <span className="text-[var(--ink-1)] font-mono">{log.weight} kg</span>
                  )}
                  {log.blob && <Camera size={12} className="text-[var(--accent)]" />}
                </div>
                <button onClick={() => deleteLog(log.id)}
                  className="text-[var(--ink-3)] hover:text-[var(--danger)] transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!logs || logs.length === 0) && (
        <div className="os-block p-8 text-center">
          <div className="serif text-2xl text-[var(--ink-3)] mb-2">Start logging.</div>
          <p className="text-sm text-[var(--ink-3)]">
            Log your weight and progress photos daily. Trends appear once you have 2+ entries.
          </p>
        </div>
      )}
    </div>
  );
}
