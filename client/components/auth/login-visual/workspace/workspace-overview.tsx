"use client";

import { motion } from "framer-motion";
import type { Ticket, WorkspaceMetrics } from "./workspace-config";
import { EASE } from "./workspace-config";
import { TEAM_MEMBERS } from "./workspace-config";
import { MetricCard } from "./metric-card";
import { TicketQueue } from "./ticket-queue";
import { WorkspaceSideRail } from "./workspace-side-rail";

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
      className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_168px] xl:gap-4"
      initial={entered ? false : { opacity: 0, y: 16, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.85, ease: EASE }}
    >
      <div className="min-w-0 rounded-[10px] border border-white/10 bg-[rgba(20,11,7,0.62)] p-3.5 shadow-[0_24px_64px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl xl:p-4">
        <div className="mb-3 flex items-center justify-between gap-2 xl:mb-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/42">Support overview</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-medium text-white">Live queue</span>
              {showLivePulse ? (
                <motion.span
                  className="size-1.5 rounded-full bg-emerald-400/90"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                />
              ) : (
                <span className="size-1.5 rounded-full bg-emerald-400/90" aria-hidden="true" />
              )}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-white/55">
            Workspace active
          </span>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5 xl:mb-3.5 xl:gap-2">
          <MetricCard label="Open" value={metrics.open} />
          <MetricCard label="Waiting" value={metrics.waiting} />
          <MetricCard label="Resolved today" value={metrics.resolved} />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-white/38">Ticket queue</p>
          <p className="text-[9px] text-white/32">{tickets.length} active</p>
        </div>

        <TicketQueue
          tickets={tickets}
          highlightedId={highlightedId}
          exitingId={exitingId}
          slaCompleteId={slaCompleteId}
        />

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 xl:hidden">
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="flex -space-x-1.5">
              {TEAM_MEMBERS.filter((m) => m.online).map((member) => (
                <div
                  key={member.initials}
                  className="flex size-5 items-center justify-center rounded-full bg-white/10 text-[8px] font-medium text-white/80 ring-2 ring-[#1a0c06]"
                >
                  {member.initials}
                </div>
              ))}
            </div>
            <span className="text-[9px] text-white/40">Team online</span>
          </div>
          {activity ? (
            <p className="min-w-0 truncate text-[9px] text-white/55">{activity}</p>
          ) : (
            <p className="text-[9px] text-white/40">4.2m avg response</p>
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
