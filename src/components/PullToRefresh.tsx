"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 80; // px of pull needed to trigger

type State = "idle" | "pulling" | "ready" | "loading";

export function PullToRefresh() {
  const [y, setY]         = useState(0);
  const [state, setState] = useState<State>("idle");

  const startY   = useRef(0);
  const curY     = useRef(0);
  const active   = useRef(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      // Only activate when truly at the top of the page
      if (window.scrollY > 2) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function onMove(e: TouchEvent) {
      if (!active.current) return;
      // If user scrolled down even a bit, deactivate
      if (window.scrollY > 2) { active.current = false; setY(0); setState("idle"); return; }

      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) return; // upward swipe — ignore

      // Rubber-band: resistance increases near threshold
      curY.current = Math.min(delta * 0.45, THRESHOLD + 28);
      setY(curY.current);
      setState(curY.current >= THRESHOLD ? "ready" : "pulling");
    }

    function onEnd() {
      if (!active.current) return;
      active.current = false;

      if (curY.current >= THRESHOLD) {
        setState("loading");
        setY(44); // keep indicator visible while loading
        curY.current = 0;
        setTimeout(() => window.location.reload(), 600);
      } else {
        curY.current = 0;
        setY(0);
        setState("idle");
      }
    }

    // passive: true — we never call preventDefault, so scrolling is unaffected
    window.addEventListener("touchstart",  onStart,  { passive: true });
    window.addEventListener("touchmove",   onMove,   { passive: true });
    window.addEventListener("touchend",    onEnd,    { passive: true });
    window.addEventListener("touchcancel", onEnd,    { passive: true });

    return () => {
      window.removeEventListener("touchstart",  onStart);
      window.removeEventListener("touchmove",   onMove);
      window.removeEventListener("touchend",    onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (state === "idle" || y < 6) return null;

  const progress  = Math.min(y / THRESHOLD, 1);
  const opacity   = Math.min(y / 28, 1);
  const rotateIcon = state === "ready" ? 180 : Math.round(progress * 140);

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0px)" }}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          color: state === "ready" ? "var(--accent-strong)" : "var(--accent)",
          transform: `translateY(${y}px)`,
          opacity,
          transition: state === "loading" ? "transform 0.2s ease, opacity 0.2s ease" : "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        <RefreshCw
          size={11}
          style={{
            transform: `rotate(${state === "loading" ? 0 : rotateIcon}deg)`,
            transition: state === "loading" ? "none" : "transform 0.1s linear",
          }}
          className={state === "loading" ? "animate-spin" : ""}
        />
        <span>
          {state === "loading" ? "Refreshing…" : state === "ready" ? "Release" : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
}
