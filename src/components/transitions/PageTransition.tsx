"use client";

import { motion } from "framer-motion";

const variants = {
  hidden:  { opacity: 0, y: 14 },
  enter:   { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
