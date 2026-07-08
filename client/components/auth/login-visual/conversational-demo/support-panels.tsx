"use client";

import { ArrowRight, BarChart3, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardGlow, TEAM_MEMBERS, type DemoPhase, type DemoScenario } from "./demo-config";
import { CardHeader, DemoCard } from "./inbox-panel";

type TeamPanelProps = {
  scenario: DemoScenario;
  phase: DemoPhase;
  entered: boolean;
};

export function TeamPanel({ scenario, phase, entered }: TeamPanelProps) {
  const glow = cardGlow(phase, "team");
  const assignedAgent = scenario.ticket.agent.name;

  return (
    <DemoCard glow={glow} entered={entered} delay={0.14} className="col-span-12 sm:col-span-5">
      <CardHeader
        icon={<Users className="size-3.5 text-[#D85A30]" />}
        title="Team"
        badge={`${TEAM_MEMBERS.filter((m) => m.online).length} online`}
      />
      <ul className="space-y-2">
        {TEAM_MEMBERS.map((member) => {
          const isAssigned =
            ["assigned", "agent-typing", "resolved", "hold"].includes(phase) &&
            member.name === assignedAgent;
          return (
            <li
              key={member.initials}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors",
                isAssigned
                  ? "border-[#D85A30]/25 bg-[#D85A30]/6"
                  : "border-black/[0.05] bg-[#fafafa]",
              )}
            >
              <div className="relative">
                <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#f0997b] to-[#d85a30] text-[9px] font-semibold text-white">
                  {member.initials}
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-white",
                    member.online ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-[#333]">{member.name}</p>
                <p className="truncate text-[9px] text-[#999]">{member.role}</p>
              </div>
              <span className="shrink-0 text-[9px] tabular-nums text-[#aaa]">
                {member.tickets} open
              </span>
            </li>
          );
        })}
      </ul>
    </DemoCard>
  );
}

type MetricsPanelProps = {
  scenario: DemoScenario;
  phase: DemoPhase;
  entered: boolean;
};

export function MetricsPanel({ scenario, phase, entered }: MetricsPanelProps) {
  const glow = cardGlow(phase, "metrics");
  const bumpResolved = phase === "resolved" || phase === "hold";
  const metrics = {
    ...scenario.metrics,
    resolved: bumpResolved ? scenario.metrics.resolved + 1 : scenario.metrics.resolved,
    open: bumpResolved ? Math.max(0, scenario.metrics.open - 1) : scenario.metrics.open,
  };

  return (
    <DemoCard glow={glow} entered={entered} delay={0.2} className="col-span-6 sm:col-span-4">
      <CardHeader icon={<BarChart3 className="size-3.5 text-[#D85A30]" />} title="Queue" />
      <div className="grid grid-cols-1 gap-1.5">
        <MetricRow label="Open" value={metrics.open} />
        <MetricRow label="Waiting" value={metrics.waiting} />
        <MetricRow label="Resolved today" value={metrics.resolved} highlight={bumpResolved} />
      </div>
    </DemoCard>
  );
}

function MetricRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-2 py-1.5",
        highlight ? "border-emerald-200/80 bg-emerald-50/80" : "border-black/[0.05] bg-[#fafafa]",
      )}
    >
      <span className="text-[9px] uppercase tracking-wide text-[#999]">{label}</span>
      <span
        className={cn(
          "text-[12px] font-semibold tabular-nums",
          highlight ? "text-emerald-700" : "text-[#333]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

type RoutingPanelProps = {
  scenario: DemoScenario;
  phase: DemoPhase;
  entered: boolean;
};

export function RoutingPanel({ scenario, phase, entered }: RoutingPanelProps) {
  const glow = cardGlow(phase, "routing");
  const active = ["routing", "assigned", "agent-typing", "resolved", "hold"].includes(phase);

  return (
    <DemoCard glow={glow} entered={entered} delay={0.26} className="col-span-6 sm:col-span-8">
      <CardHeader
        icon={<Zap className="size-3.5 text-[#D85A30]" />}
        title="Automations"
        badge={scenario.routing.label}
      />
      <div
        className={cn(
          "rounded-xl border px-2.5 py-2 text-[11px] leading-relaxed transition-colors",
          active
            ? "border-[#D85A30]/25 bg-[#D85A30]/6 text-[#5c2d18]"
            : "border-black/[0.05] bg-[#fafafa] text-[#666]",
        )}
      >
        <RoutingRuleText rule={scenario.routing.rule} />
      </div>
    </DemoCard>
  );
}

function RoutingRuleText({ rule }: { rule: string }) {
  const arrowIndex = rule.indexOf("→");
  if (arrowIndex === -1) {
    return (
      <>
        <span className="font-semibold text-[#D85A30]">If</span> {rule}
      </>
    );
  }

  const when = rule.slice(0, arrowIndex).trim();
  const then = rule.slice(arrowIndex + 1).trim();

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <span className="font-semibold text-[#D85A30]">If</span>
      <span>{when}</span>
      <ArrowRight className="size-3 shrink-0 text-[#D85A30]" strokeWidth={2.5} aria-hidden="true" />
      <span>{then}</span>
    </span>
  );
}
