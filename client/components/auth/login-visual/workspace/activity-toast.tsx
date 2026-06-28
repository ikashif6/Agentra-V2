"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "./workspace-config";

type ActivityToastProps = {
  message: string | null;
};

export function ActivityToast({ message }: ActivityToastProps) {
  return (
    <div className="relative min-h-[72px]" aria-hidden="true">
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="rounded-xl border border-white/10 bg-[rgba(18,10,6,0.72)] px-3 py-2.5 shadow-lg backdrop-blur-md"
          >
            <p className="text-[9px] uppercase tracking-wider text-white/38">Activity</p>
            <p className="mt-1 text-[10px] leading-snug text-white/78">{message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
