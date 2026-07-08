"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, Users } from "lucide-react";
import { EASE, TEAM_MEMBERS, WORKSPACE_SNAPSHOT } from "./workspace-config";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_ICON_WRAP,
  WORKSPACE_INNER_TILE,
  WORKSPACE_SECTION_LABEL,
  WORKSPACE_WHITE_CARD,
} from "./workspace-surfaces";

type WorkspaceSideRailProps = {
  activity: string | null;
  activityHistory: string[];
  entered: boolean;
};

function SideCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(WORKSPACE_WHITE_CARD, "p-2.5")}>
      <div className="mb-2.5 flex items-center gap-2">
        <div className={WORKSPACE_ICON_WRAP}>{icon}</div>
        <p className={WORKSPACE_SECTION_LABEL}>{title}</p>
      </div>
      {children}
    </div>
  );
}

export function WorkspaceSideRail({
  activity,
  activityHistory,
  entered,
}: WorkspaceSideRailProps) {
  const feedItems = activity
    ? [activity, ...activityHistory.filter((item) => item !== activity)].slice(0, 4)
    : activityHistory.slice(0, 4);

  return (
    <motion.div
      className="pointer-events-none flex flex-col gap-2.5 select-none"
      initial={entered ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
      aria-hidden="true"
    >
      <SideCard icon={<Users className="size-3.5" />} title="Team online">
        <ul className="space-y-2">
          {TEAM_MEMBERS.map((member) => (
            <li
              key={member.initials}
              className={cn(WORKSPACE_INNER_TILE, "flex items-center justify-between gap-2 px-2 py-1.5")}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                  <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#f0997b] to-[#d85a30] text-[9px] font-semibold text-white">
                    {member.initials}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-white",
                      member.online ? "bg-emerald-500" : "bg-slate-300",
                    )}
                  />
                </div>
                <span className="truncate text-[10px] font-medium text-[#333]">{member.name}</span>
              </div>
              <span className="shrink-0 text-[9px] tabular-nums text-[#aaa]">
                {member.tickets} open
              </span>
            </li>
          ))}
        </ul>
      </SideCard>

      <SideCard icon={<BarChart3 className="size-3.5" />} title="Today">
        <dl className="space-y-2">
          <MetricRow label="Avg response" value={WORKSPACE_SNAPSHOT.avgResponse} />
          <MetricRow label="SLA met" value={WORKSPACE_SNAPSHOT.slaMet} accent />
          <MetricRow
            label="Channels"
            value={`${WORKSPACE_SNAPSHOT.channelsActive} active`}
          />
        </dl>
      </SideCard>

      <SideCard icon={<Activity className="size-3.5" />} title="Activity">
        <ul className="max-h-[92px] space-y-1.5 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {feedItems.length > 0 ? (
              feedItems.map((item, index) => (
                <motion.li
                  key={`${item}-${index}`}
                  layout
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{
                    opacity: index === 0 ? 1 : 0.65 - index * 0.12,
                    y: 0,
                    filter: "blur(0px)",
                  }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.38, ease: EASE }}
                  className={cn(
                    WORKSPACE_INNER_TILE,
                    "px-2.5 py-2",
                    index === 0 && "border-[#D85A30]/20 bg-[#D85A30]/[0.05]",
                  )}
                >
                  <p className="text-[10px] leading-snug text-[#444]">{item}</p>
                </motion.li>
              ))
            ) : (
              <li className={cn(WORKSPACE_INNER_TILE, "px-2.5 py-3 text-center text-[10px] text-[#bbb]")}>
                Quiet for now
              </li>
            )}
          </AnimatePresence>
        </ul>
      </SideCard>
    </motion.div>
  );
}

function MetricRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(WORKSPACE_INNER_TILE, "flex items-center justify-between gap-2 px-2 py-1.5")}>
      <dt className="text-[10px] text-[#888]">{label}</dt>
      <dd
        className={cn(
          "text-[10px] font-semibold tabular-nums",
          accent ? "text-[#3D5238]" : "text-[#333]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
