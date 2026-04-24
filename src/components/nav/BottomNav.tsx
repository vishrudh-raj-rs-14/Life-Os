"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, GitBranch, LayoutGrid, Mic, Timer, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/",       label: "Now",   Icon: LayoutGrid },
  { href: "/goals",  label: "Goals", Icon: GitBranch  },
  { href: "/focus",  label: "Focus", Icon: Timer      },
  { href: "/body",   label: "Body",  Icon: Activity   },
  { href: "/notes",  label: "Notes", Icon: Mic        },
  { href: "/profile",label: "You",   Icon: User       },
] as const;

export function BottomNav() {
  const path = usePathname();

  function isActive(href: string) {
    return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="grid grid-cols-6 gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-1.5 py-1.5">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            const isFocus = href === "/focus";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-[3px] rounded-xl py-1.5 px-0.5 transition-all duration-150",
                  /* Focus tab gets a filled pill to stand out */
                  isFocus && active
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : isFocus
                    ? "bg-[var(--surface-2)] text-[var(--accent)]"
                    : active
                    ? "text-[var(--accent)]"
                    : "text-[var(--ink-3)]"
                )}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.6} />
                <span className={cn(
                  "text-[9px] font-mono uppercase tracking-wide leading-none",
                  !active && "opacity-60"
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
