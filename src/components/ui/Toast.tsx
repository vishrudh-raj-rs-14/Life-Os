"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  emoji?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 3500);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(t: Omit<Toast, "id">) {
  useToastStore.getState().push(t);
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  // hydrate-safe noop
  useEffect(() => {}, []);
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[92%] max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)]/95 backdrop-blur p-4 text-left shadow-xl"
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
          >
            <div className="flex items-start gap-3">
              {t.emoji && <div className="text-2xl">{t.emoji}</div>}
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--ink-1)]">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-[var(--ink-3)] mt-0.5">
                    {t.description}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
