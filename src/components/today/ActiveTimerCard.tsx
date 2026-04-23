"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import type { Habit } from "@/types";

export function ActiveTimerCard({
  goal,
  startedAt,
}: {
  goal: Habit; // flat model: "goal" = habit
  startedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const sec = Math.floor((now - startedAt) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
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
          <Timer size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="os-label flex items-center gap-1.5">
            <span className="dot dot-on" /> live focus
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
