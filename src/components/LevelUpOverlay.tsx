"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface Props {
  level: number;
  levelName: string;
  onDone: () => void;
}

export function LevelUpOverlay({ level, levelName, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={onDone}
      >
        {/* particles */}
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{ background: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "#D97757" : "#7AA98A" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: (Math.random() - 0.5) * 320,
              y: (Math.random() - 0.5) * 320,
              opacity: 0,
              scale: Math.random() * 2 + 0.5,
            }}
            transition={{ duration: 1.2 + Math.random() * 0.6, ease: "easeOut", delay: 0.1 }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="text-center px-8"
        >
          <motion.div
            animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center justify-center h-20 w-20 rounded-2xl mb-4 mx-auto"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <Zap size={36} strokeWidth={2.5} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm font-mono text-[var(--accent)] uppercase tracking-widest mb-1">
              Level up
            </p>
            <p className="serif text-5xl text-white mb-2">LV {level}</p>
            <p className="text-lg text-white/70 font-medium">{levelName}</p>
            <p className="text-xs text-white/40 mt-4 font-mono">tap to continue</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
