"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "compound-install-dismissed";

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-3 right-3 z-40 mx-auto max-w-md"
      >
        <div className="os-block-strong p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 flex items-center justify-center shrink-0 text-[var(--accent)]">
            <Download size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--ink-1)]">Install Life OS</div>
            <div className="text-xs text-[var(--ink-3)]">
              Add to home screen for fast access.
            </div>
          </div>
          <button
            onClick={async () => {
              await evt.prompt();
              await evt.userChoice;
              localStorage.setItem(KEY, "1");
              setEvt(null);
            }}
            className="rounded-md bg-[var(--accent)] text-[var(--bg)] px-3 py-2 text-xs font-semibold"
          >
            Install
          </button>
          <button
            onClick={() => {
              localStorage.setItem(KEY, "1");
              setEvt(null);
            }}
            className="rounded-md p-1.5 hover:bg-[var(--surface)] text-[var(--ink-3)]"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
