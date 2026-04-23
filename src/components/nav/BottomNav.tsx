"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  LayoutGrid,
  Mic,
  Timer,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Life OS nav:
//   Now    — today's habits
//   Goals  — your pipelines
//   Focus  — timer (centre, elevated)
//   Notes  — voice notes to self
//   You    — profile + review + settings
const items = [
  { href: "/", label: "Now", Icon: LayoutGrid },
  { href: "/goals", label: "Goals", Icon: GitBranch },
  { href: "/focus", label: "Focus", Icon: Timer, accent: true },
  { href: "/notes", label: "Notes", Icon: Mic },
  { href: "/profile", label: "You", Icon: User },
];

export function BottomNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="relative flex items-end justify-between gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-1.5 py-1.5">
          {items.map(({ href, label, Icon, accent }) => {
            const active =
              href === "/"
                ? path === "/"
                : path === href || path.startsWith(href + "/");
            if (accent) {
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex-1 flex justify-center -mt-7"
                >
                  <div
                    className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center border transition",
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
                        : "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--accent)]"
                    )}
                  >
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  </div>
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] transition uppercase tracking-wide font-mono",
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
                <span className="leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
