"use client";

import { motion } from "framer-motion";
import { EASE } from "./workspace-config";
import type { Ticket } from "./workspace-config";
import { SLAIndicator } from "./sla-indicator";
import { StatusBadge } from "./status-badge";
import { TeamAvatarGroup } from "./team-avatar-group";
import { cn } from "@/lib/utils";

type TicketRowProps = {
  ticket: Ticket;
  highlighted?: boolean;
  exiting?: boolean;
  slaComplete?: boolean;
};

export function TicketRow({ ticket, highlighted, exiting, slaComplete }: TicketRowProps) {
  const showAssignee = ticket.status === "assigned" && ticket.assigneeInitials;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        opacity: exiting ? 0 : 1,
        y: exiting ? 10 : 0,
        scale: exiting ? 0.98 : 1,
      }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn(
        "relative rounded-[10px] border px-3 py-2 xl:py-2.5 transition-colors",
        highlighted
          ? "border-[#F0997B]/35 bg-[#D85A30]/10 ring-1 ring-[#F0997B]/20"
          : "border-white/8 bg-black/18",
        exiting && "pointer-events-none",
      )}
    >
      {highlighted ? (
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]"
          aria-hidden="true"
        >
          <motion.div
            className="absolute -left-1/3 top-0 h-full w-1/3 bg-linear-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "320%" }}
            transition={{ duration: 1.1, ease: EASE }}
          />
        </motion.div>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {ticket.isNew ? (
              <span className="size-1.5 shrink-0 rounded-full bg-[#F0997B]" aria-hidden="true" />
            ) : null}
            <p className="truncate text-[11px] font-medium text-white/92">{ticket.subject}</p>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-white/45">{ticket.customer}</p>
        </div>
        <StatusBadge status={ticket.status} compact />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[9px] text-white/38">{ticket.category}</span>
          {ticket.priority === "high" ? (
            <span className="shrink-0 text-[9px] font-medium text-[#F0997B]/90">High</span>
          ) : null}
          {showAssignee ? (
            <TeamAvatarGroup initials={ticket.assigneeInitials!} name={ticket.assignee} />
          ) : null}
        </div>
        {ticket.slaProgress !== undefined ? (
          <SLAIndicator
            progress={ticket.slaProgress}
            complete={slaComplete}
            compact
          />
        ) : null}
      </div>
    </motion.div>
  );
}
