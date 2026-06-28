"use client";

import { motion } from "framer-motion";
import { EASE } from "./workspace-config";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: number;
  className?: string;
};

export function MetricCard({ label, value, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-white/8 bg-black/20 px-2.5 py-2 xl:px-3 xl:py-2.5",
        className,
      )}
    >
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <motion.p
        key={value}
        className="mt-0.5 text-base font-semibold tabular-nums text-white xl:text-lg"
        initial={{ opacity: 0.6, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {value}
      </motion.p>
    </div>
  );
}
