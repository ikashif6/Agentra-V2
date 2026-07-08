"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "./workspace-config";
import type { TicketStatus } from "./workspace-config";
import { cn } from "@/lib/utils";

/** Warm Agentra palette — no generic AI blues */
const STATUS_STYLES: Record<TicketStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "border-[#D85A30]/35 bg-[#D85A30] text-white",
  },
  open: {
    label: "Open",
    className: "border-[#C9785A]/40 bg-[#F0997B]/25 text-[#7A3318]",
  },
  assigned: {
    label: "Assigned",
    className: "border-[#B84A28]/30 bg-[#D85A30]/15 text-[#8B3D22]",
  },
  waiting: {
    label: "Waiting",
    className: "border-[#D4C4B8] bg-[#F3EBE4] text-[#5C483C]",
  },
  resolved: {
    label: "Resolved",
    className: "border-[#B8C9B0] bg-[#E2EBDE] text-[#3D5238]",
  },
};

type StatusBadgeProps = {
  status: TicketStatus;
  compact?: boolean;
};

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <motion.span
      layout
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-2 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        style.className,
      )}
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {status === "resolved" ? <Check className="size-2.5" aria-hidden="true" /> : null}
      {style.label}
    </motion.span>
  );
}
