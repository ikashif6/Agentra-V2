"use client";

import { motion } from "framer-motion";
import { EASE } from "./workspace-config";
import { METRIC_TILE_STYLES, type MetricTileKey } from "./workspace-surfaces";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: number;
  variant: MetricTileKey;
  className?: string;
};

export function MetricCard({ label, value, variant, className }: MetricCardProps) {
  const tile = METRIC_TILE_STYLES[variant];

  return (
    <div
      className={cn(
        "rounded-[14px] border px-2.5 py-2 xl:px-3 xl:py-2.5",
        tile,
        className,
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <motion.p
        key={value}
        className="mt-0.5 text-base font-semibold tabular-nums xl:text-lg"
        initial={{ opacity: 0.6, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {value}
      </motion.p>
    </div>
  );
}
