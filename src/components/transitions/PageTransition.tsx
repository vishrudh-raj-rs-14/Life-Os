"use client";

import { motion } from "framer-motion";

// Simple fade-in only — no AnimatePresence, no exit animation.
// Using AnimatePresence with mode="sync" caused old+new pages to render
// simultaneously in document flow, pushing the incoming page off-screen.
export function PageTransition({ children, key: _key }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
