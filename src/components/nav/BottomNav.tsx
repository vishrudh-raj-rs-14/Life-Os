"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutGrid, Mic, Timer, User } from "lucide-react";
import { cn } from "@/lib/utils";

// 5-item nav: Home | Body | [Focus↑ centre] | Notes | You
// Focus is item 3 of 5 → mathematically centred.
const LEFT = [
  { href: "/",        label: "Home",  Icon: LayoutGrid },
  { href: "/body",    label: "Body",  Icon: Activity   },
];
const RIGHT = [
  { href: "/notes",   label: "Notes", Icon: Mic  },
  { href: "/profile", label: "You",   Icon: User },
];

function NavItem({ href, label, Icon }: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  const path   = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-[3px] py-2 rounded-xl transition-all duration-150",
        active ? "text-[var(--accent)]" : "text-[var(--ink-3)]"
      )}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.6} />
      <span className={cn(
        "text-[9px] font-mono uppercase tracking-wide leading-none transition-opacity",
        active ? "opacity-100" : "opacity-50"
      )}>
        {label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const path        = usePathname();
  const focusActive = path === "/focus";

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="flex items-end gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-1.5 py-1.5">
          {LEFT.map(item => <NavItem key={item.href} {...item} />)}

          {/* Focus — elevated centre button */}
          <Link href="/focus" className="flex-1 flex justify-center -mt-5">
            <div className={cn(
              "h-12 w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all duration-150",
              focusActive
                ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)] shadow-lg"
                : "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--accent)] shadow-md"
            )}>
              <Timer size={18} strokeWidth={focusActive ? 2.2 : 1.8} />
              <span className="text-[8px] font-mono uppercase tracking-wide leading-none opacity-70">
                Focus
              </span>
            </div>
          </Link>

          {RIGHT.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </div>
    </nav>
  );
}
