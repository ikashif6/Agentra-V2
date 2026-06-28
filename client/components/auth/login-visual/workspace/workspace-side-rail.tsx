"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EASE, TEAM_MEMBERS, WORKSPACE_SNAPSHOT } from "./workspace-config";
import { cn } from "@/lib/utils";

const surface =
  "rounded-[10px] border border-white/10 bg-[rgba(18,10,6,0.58)] backdrop-blur-xl shadow-[0_16px_48px_-24px_rgba(0,0,0,0.65)]";

type WorkspaceSideRailProps = {
  activity: string | null;
  activityHistory: string[];
  entered: boolean;
};

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
      className="flex flex-col gap-3"
      initial={entered ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
      aria-hidden="true"
    >
      <div className={cn(surface, "p-3")}>
        <p className="text-[9px] uppercase tracking-wider text-white/38">Team online</p>
        <ul className="mt-2.5 space-y-2">
          {TEAM_MEMBERS.map((member) => (
            <li key={member.initials} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                  <div className="flex size-6 items-center justify-center rounded-full bg-white/10 text-[9px] font-medium text-white/85">
                    {member.initials}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-[#1a0c06]",
                      member.online ? "bg-emerald-400" : "bg-white/30",
                    )}
                  />
                </div>
                <span className="truncate text-[10px] text-white/72">{member.name}</span>
              </div>
              <span className="shrink-0 text-[9px] tabular-nums text-white/35">
                {member.tickets} open
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn(surface, "p-3")}>
        <p className="text-[9px] uppercase tracking-wider text-white/38">Today</p>
        <dl className="mt-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[10px] text-white/45">Avg response</dt>
            <dd className="text-[10px] font-medium tabular-nums text-white/82">
              {WORKSPACE_SNAPSHOT.avgResponse}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[10px] text-white/45">SLA met</dt>
            <dd className="text-[10px] font-medium tabular-nums text-emerald-200/90">
              {WORKSPACE_SNAPSHOT.slaMet}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[10px] text-white/45">Channels</dt>
            <dd className="text-[10px] font-medium tabular-nums text-white/82">
              {WORKSPACE_SNAPSHOT.channelsActive} active
            </dd>
          </div>
        </dl>
      </div>

      <div className={cn(surface, "p-3")}>
        <p className="mb-2 text-[9px] uppercase tracking-wider text-white/38">Activity</p>
        <ul className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {feedItems.map((item, index) => (
              <motion.li
                key={`${item}-${index}`}
                layout
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{
                  opacity: index === 0 ? 1 : 0.55 - index * 0.1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.38, ease: EASE }}
                className={cn(
                  "rounded-[10px] border px-2.5 py-2",
                  index === 0
                    ? "border-[#F0997B]/25 bg-[#D85A30]/12"
                    : "border-white/6 bg-black/15",
                )}
              >
                <p className="text-[10px] leading-snug text-white/75">{item}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}
