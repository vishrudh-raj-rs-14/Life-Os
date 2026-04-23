"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0..1
  className?: string;
  barClassName?: string;
}

export function Progress({ value, className, barClassName }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn(
        "h-1.5 w-full rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]",
        className
      )}
    >
      <motion.div
        className={cn("h-full rounded-full bg-[var(--accent)]", barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
      />
    </div>
  );
}

export function RingProgress({
  value,
  size = 96,
  stroke = 10,
  children,
  color = "var(--accent)",
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
