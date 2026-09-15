"use client";

import { motion, useIsPresent, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export default function ScreenTransition({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return <motion.div
    inert={!present}
    aria-hidden={!present}
    initial={{ opacity: reduced ? 1 : 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : 0.14 }}
  >{children}</motion.div>;
}
