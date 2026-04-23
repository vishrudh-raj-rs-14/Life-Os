"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { format, parseISO, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { LOCAL_USER_ID, todayISO, cn } from "@/lib/utils";
import type { VoiceNote } from "@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // yyyy-MM
}

function monthLabel(key: string): string {
  const d = parseISO(`${key}-01`);
  return format(d, "MMMM yyyy");
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMM");
}

// ─── Waveform bar visualizer ──────────────────────────────────────────────────

function WaveformBars({
  analyser,
  active,
  barCount = 48,
}: {
  analyser: AnalyserNode | null;
  active: boolean;
  barCount?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !active) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const ctx = canvas.getContext("2d")!;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyser!.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      const barW = canvas!.width / barCount - 1.5;
      const step = Math.floor(data.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] / 255;
        const h = Math.max(3, val * canvas!.height);
        const x = i * (barW + 1.5);
        const y = (canvas!.height - h) / 2;
        // colour: accent with opacity proportional to amplitude
        ctx.fillStyle = `rgba(201,169,110,${0.3 + val * 0.7})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      }
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active, barCount]);

  // Static idle bars
  if (!active || !analyser) {
    return (
      <div className="flex items-center justify-center gap-[3px] h-12">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="rounded-full bg-[var(--accent)]/20"
            style={{
              width: 3,
              height: `${10 + Math.sin(i * 0.6) * 8}%`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={48}
      className="w-full h-12"
    />
  );
}

// ─── Playback waveform (static bars from duration) ────────────────────────────

function StaticWave({
  duration,
  progress,
  barCount = 40,
}: {
  duration: number;
  progress: number;
  barCount?: number;
}) {
  // Deterministic heights seeded from duration
  const heights = useMemo(() => {
    const h: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const v = Math.abs(Math.sin(i * 0.9 + duration * 0.07));
      h.push(8 + v * 28);
    }
    return h;
  }, [duration, barCount]);

  const filled = Math.round(progress * barCount);

  return (
    <div className="flex items-center gap-[2px] h-8 w-full">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-colors"
          style={{
            height: h,
            background:
              i < filled
                ? "var(--accent)"
                : "rgba(201,169,110,0.2)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Single note card ─────────────────────────────────────────────────────────

function NoteCard({ note }: { note: VoiceNote }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string>("");

  useEffect(() => {
    const url = URL.createObjectURL(note.blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
    };
  }, [note.blob]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }

  async function del() {
    const audio = audioRef.current;
    audio?.pause();
    await db().voiceNotes.delete(note.id);
  }

  return (
    <div className="os-block p-3 group">
      <div className="flex items-center gap-3">
        {/* play/pause button */}
        <button
          onClick={togglePlay}
          className={cn(
            "h-9 w-9 rounded-md border flex items-center justify-center shrink-0 transition",
            playing
              ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
              : "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--accent)] hover:border-[var(--accent)]/60"
          )}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* waveform + meta */}
        <div className="flex-1 min-w-0">
          {note.title && (
            <div className="text-[12px] font-medium text-[var(--ink-1)] truncate mb-1">
              {note.title}
            </div>
          )}
          <StaticWave duration={note.duration} progress={progress} />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] font-mono text-[var(--ink-3)]">
              {playing
                ? fmtDuration(progress * note.duration)
                : fmtDuration(note.duration)}
            </span>
            <span className="text-[10px] font-mono text-[var(--ink-3)]">
              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* delete */}
        <button
          onClick={del}
          className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Month group ──────────────────────────────────────────────────────────────

function MonthGroup({ monthK, notes }: { monthK: string; notes: VoiceNote[] }) {
  const [open, setOpen] = useState(monthK === monthKey(todayISO()));

  // Group by day within month
  const byDay = useMemo(() => {
    const map = new Map<string, VoiceNote[]>();
    for (const n of notes) {
      const arr = map.get(n.date) ?? [];
      arr.push(n);
      map.set(n.date, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes]);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <span className="serif text-xl text-[var(--ink-1)]">
            {monthLabel(monthK)}
          </span>
          <span className="os-label text-[var(--ink-3)]">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="text-[var(--ink-3)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div className="space-y-3 pl-0">
          {byDay.map(([day, dayNotes]) => (
            <div key={day} className="space-y-1.5">
              <div className="os-label pl-1">{dayLabel(day)}</div>
              {dayNotes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recorder ─────────────────────────────────────────────────────────────────

function Recorder({ onSaved }: { onSaved: () => void }) {
  const { user } = useUser();
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Analyser for visualizer
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    setAnalyser(an);

    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.start(100);
    setState("recording");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stop = useCallback(async () => {
    if (!mediaRef.current) return;
    setState("saving");
    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((res) => {
      mediaRef.current!.onstop = () => res();
      mediaRef.current!.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const duration = elapsed;

    await db().voiceNotes.add({
      id: nanoid(),
      userId: user?.userId ?? LOCAL_USER_ID,
      blob,
      duration,
      date: todayISO(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setAnalyser(null);
    setState("idle");
    setElapsed(0);
    onSaved();
  }, [elapsed, user, onSaved]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const isRecording = state === "recording";

  return (
    <div className="os-block-strong p-5 flex flex-col items-center gap-4">
      {/* Waveform visualizer */}
      <div className="w-full">
        <WaveformBars analyser={analyser} active={isRecording} />
      </div>

      {/* Timer */}
      <div
        className={cn(
          "font-mono text-3xl tabular-nums tracking-tight transition-colors",
          isRecording ? "text-[var(--accent)]" : "text-[var(--ink-3)]"
        )}
      >
        {fmtDuration(elapsed)}
      </div>

      {/* Record / stop button */}
      <button
        onClick={isRecording ? stop : start}
        disabled={state === "saving"}
        className={cn(
          "relative h-16 w-16 rounded-full flex items-center justify-center transition-all",
          isRecording
            ? "bg-[var(--danger)] shadow-[0_0_0_6px_rgba(220,80,60,0.15)]"
            : "bg-[var(--accent)] shadow-[0_0_0_6px_rgba(201,169,110,0.12)]",
          state === "saving" && "opacity-50"
        )}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <MicOff size={22} className="text-white" />
        ) : (
          <Mic size={22} className="text-[var(--bg)]" />
        )}
        {/* Pulse ring when recording */}
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping bg-[var(--danger)]/30" />
        )}
      </button>

      <p className="text-[11px] text-[var(--ink-3)] font-mono text-center">
        {state === "saving"
          ? "saving…"
          : isRecording
            ? "tap to stop"
            : "tap to record"}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const { user } = useUser();
  const [saved, setSaved] = useState(0); // bump to force refresh hint

  const notes = useLiveQuery(
    () =>
      db()
        .voiceNotes.orderBy("createdAt")
        .reverse()
        .filter((n) => !n.deletedAt)
        .toArray(),
    [saved]
  );

  // Group by month
  const byMonth = useMemo(() => {
    if (!notes) return [];
    const map = new Map<string, VoiceNote[]>();
    for (const n of notes) {
      const mk = monthKey(n.date);
      const arr = map.get(mk) ?? [];
      arr.push(n);
      map.set(mk, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes]);

  if (!user) return null;

  return (
    <div className="px-5 pt-6 pb-10 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div>
        <div className="os-label">To myself</div>
        <h1 className="serif text-4xl text-[var(--ink-1)]">Voice Notes</h1>
        <p className="text-sm text-[var(--ink-3)] mt-1">
          Thoughts, intentions, reflections. Speak — the OS listens.
        </p>
      </div>

      {/* Recorder */}
      <Recorder onSaved={() => setSaved((s) => s + 1)} />

      {/* Notes list */}
      {byMonth.length === 0 ? (
        <div className="os-block p-8 text-center">
          <div className="serif text-2xl text-[var(--ink-3)] mb-1">Empty.</div>
          <p className="text-sm text-[var(--ink-3)]">
            Record your first note above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {byMonth.map(([mk, monthNotes]) => (
            <MonthGroup key={mk} monthK={mk} notes={monthNotes} />
          ))}
        </div>
      )}
    </div>
  );
}
