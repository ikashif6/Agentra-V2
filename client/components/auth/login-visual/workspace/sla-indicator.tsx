"use client";

import { motion } from "framer-motion";
import { EASE } from "./workspace-config";
import { cn } from "@/lib/utils";

type SLAIndicatorProps = {
  progress: number;
  complete?: boolean;
  compact?: boolean;
};

export function SLAIndicator({ progress, complete, compact }: SLAIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <div
      className={cn("flex items-center gap-1.5", compact ? "min-w-[52px]" : "min-w-[58px]")}
      aria-hidden="true"
    >
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn(
            "h-full rounded-full",
            complete ? "bg-emerald-400/80" : "bg-[#F0997B]/70",
          )}
          initial={false}
          animate={{ width: `${complete ? 100 : clamped}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
      {!compact ? (
        <span className="text-[9px] tabular-nums text-white/40">
          {complete ? "OK" : `${Math.round(clamped)}%`}
        </span>
      ) : null}
    </div>
  );
}
