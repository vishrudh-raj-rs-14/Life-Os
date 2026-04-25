"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pause, Timer } from "lucide-react";
import type { Habit } from "@/types";
import { useTimer } from "@/store/useTimer";

export function ActiveTimerCard({
  goal,
}: {
  goal: Habit;
}) {
  const timer = useTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const sec = Math.floor(timer.elapsedMs(now) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const paused = !!timer.pausedAt;

  return (
    <Link href="/focus" className="block">
      <div className="os-block-strong px-3.5 py-3 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-md flex items-center justify-center border"
          style={{
            background: (goal.color ?? "#C9A96E") + "1a",
            borderColor: (goal.color ?? "#C9A96E") + "55",
            color: goal.color ?? "var(--accent)",
          }}
        >
          {paused ? <Pause size={18} /> : <Timer size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="os-label flex items-center gap-1.5">
            <span className={paused ? "dot dot-off" : "dot dot-on"} />
            {paused ? "paused" : "live focus"}
          </div>
          <div className="text-sm font-medium truncate text-[var(--ink-1)]">
            {goal.title}
          </div>
        </div>
        <div className="font-mono text-xl tabular-nums text-[var(--accent)]">
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </div>
      </div>
    </Link>
  );
}
