"use client";

import { motion } from "framer-motion";
import { Inbox, LayoutGrid } from "lucide-react";
import type { Ticket, WorkspaceMetrics } from "./workspace-config";
import { EASE, TEAM_MEMBERS } from "./workspace-config";
import { MetricCard } from "./metric-card";
import { TicketQueue } from "./ticket-queue";
import { WorkspaceSideRail } from "./workspace-side-rail";
import {
  WORKSPACE_ICON_WRAP,
  WORKSPACE_SECTION_LABEL,
  WORKSPACE_WHITE_CARD,
} from "./workspace-surfaces";

type WorkspaceOverviewProps = {
  metrics: WorkspaceMetrics;
  tickets: Ticket[];
  highlightedId: string | null;
  exitingId: string | null;
  slaCompleteId: string | null;
  activity: string | null;
  activityHistory: string[];
  showLivePulse: boolean;
  entered: boolean;
};

export function WorkspaceOverview({
  metrics,
  tickets,
  highlightedId,
  exitingId,
  slaCompleteId,
  activity,
  activityHistory,
  showLivePulse,
  entered,
}: WorkspaceOverviewProps) {
  return (
    <motion.div
      className="pointer-events-none grid w-full grid-cols-1 gap-2.5 select-none xl:grid-cols-[minmax(0,1fr)_168px] xl:gap-3"
      initial={entered ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.85, ease: EASE }}
    >
      <div className={`min-w-0 ${WORKSPACE_WHITE_CARD} p-3 xl:p-3.5`}>
        <div className="mb-3 flex items-center justify-between gap-2 xl:mb-3.5">
          <div className="flex items-start gap-2.5">
            <div className={WORKSPACE_ICON_WRAP}>
              <LayoutGrid className="size-3.5" aria-hidden="true" />
            </div>
            <div>
              <p className={WORKSPACE_SECTION_LABEL}>Support overview</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1a1a1a]">Live queue</span>
                {showLivePulse ? (
                  <motion.span
                    className="size-1.5 rounded-full bg-[#6B8F62]"
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="size-1.5 rounded-full bg-[#6B8F62]" aria-hidden="true" />
                )}
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#B8C9B0] bg-[#E2EBDE] px-2 py-1 text-[9px] font-medium text-[#3D5238]">
            Workspace active
          </span>
        </div>

        <div className="mb-2.5 grid grid-cols-3 gap-1.5 xl:mb-3 xl:gap-2">
          <MetricCard label="Open" value={metrics.open} variant="open" />
          <MetricCard label="Waiting" value={metrics.waiting} variant="waiting" />
          <MetricCard label="Resolved today" value={metrics.resolved} variant="resolved" />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Inbox className="size-3 text-[#D85A30]/80" aria-hidden="true" />
            <p className={WORKSPACE_SECTION_LABEL}>Ticket queue</p>
          </div>
          <p className="text-[9px] font-medium tabular-nums text-[#aaa]">{tickets.length} active</p>
        </div>

        <TicketQueue
          tickets={tickets}
          highlightedId={highlightedId}
          exitingId={exitingId}
          slaCompleteId={slaCompleteId}
        />

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.05] pt-3 xl:hidden">
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="flex -space-x-1.5">
              {TEAM_MEMBERS.filter((m) => m.online).map((member) => (
                <div
                  key={member.initials}
                  className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f0997b] to-[#d85a30] text-[8px] font-semibold text-white ring-2 ring-white"
                >
                  {member.initials}
                </div>
              ))}
            </div>
            <span className="text-[9px] text-[#888]">Team online</span>
          </div>
          {activity ? (
            <p className="min-w-0 truncate text-[9px] text-[#666]">{activity}</p>
          ) : (
            <p className="text-[9px] text-[#aaa]">4.2m avg response</p>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 xl:block">
        <WorkspaceSideRail
          activity={activity}
          activityHistory={activityHistory}
          entered={entered}
        />
      </div>
    </motion.div>
  );
}
