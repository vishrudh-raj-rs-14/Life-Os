"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      // Block pointer events only while animating in — prevents inputs from
      // being tapped during the 160 ms fade. Once settled, fully interactive.
      style={{ pointerEvents: done ? "auto" : "none" }}
      onAnimationComplete={() => setDone(true)}
    >
      {children}
    </motion.div>
  );
}
