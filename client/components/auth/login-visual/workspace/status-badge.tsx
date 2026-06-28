"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE } from "./workspace-config";
import type { TicketStatus } from "./workspace-config";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "bg-white/8 text-white/70 ring-1 ring-white/10",
  },
  waiting: {
    label: "Waiting",
    className: "bg-amber-500/12 text-amber-100/90 ring-1 ring-amber-400/20",
  },
  new: {
    label: "New",
    className: "bg-[#D85A30]/20 text-[#FFD8C8] ring-1 ring-[#F0997B]/25",
  },
  assigned: {
    label: "Assigned",
    className: "bg-sky-500/12 text-sky-100/90 ring-1 ring-sky-400/20",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25",
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
        "inline-flex items-center gap-1 rounded-full font-medium",
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
