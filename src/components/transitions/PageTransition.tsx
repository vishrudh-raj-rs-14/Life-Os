"use client";

import { motion } from "framer-motion";

// Pure opacity fade — no y-offset, no pointer-events blocking.
// Keeps navigation feeling instant while still being polished.
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
