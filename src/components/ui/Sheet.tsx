"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-strong)] bg-[var(--surface)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="sticky top-0 flex items-center justify-between px-5 pt-4 pb-3 bg-[var(--surface)]/95 backdrop-blur z-10">
              <div className="mx-auto h-1 w-8 rounded-full bg-[var(--border-strong)] absolute left-1/2 -translate-x-1/2 top-2" />
              <h3 className="serif text-xl pt-3 text-[var(--ink-1)]">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-md p-2 hover:bg-[var(--surface-2)]"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 pb-8 pt-2">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
