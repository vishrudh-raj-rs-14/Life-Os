"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, GitBranch, LayoutGrid, Mic, Timer, User } from "lucide-react";
import { cn } from "@/lib/utils";

// 6-item nav: Now | Goals | [Focus elevated] | Body | Notes | You
const LEFT  = [
  { href: "/",      label: "Now",   Icon: LayoutGrid },
  { href: "/goals", label: "Goals", Icon: GitBranch  },
];
const CENTER = { href: "/focus", label: "Focus", Icon: Timer };
const RIGHT  = [
  { href: "/body",    label: "Body",  Icon: Activity },
  { href: "/notes",   label: "Notes", Icon: Mic      },
  { href: "/profile", label: "You",   Icon: User     },
];

function NavItem({ href, label, Icon }: { href: string; label: string; Icon: React.ComponentType<{size?: number; strokeWidth?: number}> }) {
  const path   = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition",
        active ? "text-[var(--accent)]" : "text-[var(--ink-3)]"
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.6} />
      {/* Label only when active — saves horizontal space */}
      {active && (
        <span className="text-[9px] font-mono uppercase tracking-wide leading-none">
          {label}
        </span>
      )}
    </Link>
  );
}

export function BottomNav() {
  const path   = usePathname();
  const active = path === "/focus";

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="relative flex items-end justify-between gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-1 py-1.5">
          {LEFT.map(item => <NavItem key={item.href} {...item} />)}

          {/* Elevated Focus button in the centre */}
          <Link href="/focus" className="flex-1 flex justify-center -mt-6">
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center border transition",
              active
                ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
                : "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--accent)]"
            )}>
              <Timer size={18} strokeWidth={active ? 2.2 : 1.8} />
            </div>
          </Link>

          {RIGHT.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </div>
    </nav>
  );
}
