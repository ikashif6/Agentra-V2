"use client";

import { useState } from "react";
import Link from "next/link";
import { Circle, Mail, Users } from "lucide-react";
import { AiAgentIcon } from "@/components/icons/ai-agent-icon";
import { cn } from "@/lib/utils";
import { APP_CARD } from "@/lib/app-surfaces";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  duration: string;
  href: string;
  action: string;
  icon: React.ReactNode;
};

const SETUP_STEPS: SetupStep[] = [
  {
    id: "email",
    title: "Connect your support email",
    description: "Route customer emails into Agentra so your team can reply from one place.",
    duration: "2 min",
    href: "/settings?tab=workspace",
    action: "Connect email",
    icon: <Mail className="size-4" />,
  },
  {
    id: "team",
    title: "Invite your support team",
    description: "Add agents and admins so conversations can be assigned and tracked.",
    duration: "3 min",
    href: "/agents",
    action: "Invite teammates",
    icon: <Users className="size-4" />,
  },
  {
    id: "automate",
    title: "Explore automation",
    description: "Review AI routing options and prepare workflows for common requests.",
    duration: "4 min",
    href: "/ai-agent",
    action: "View AI Agent",
    icon: <AiAgentIcon className="size-4" />,
  },
];

export function HomeSetupPanel({ monochrome = false }: { monochrome?: boolean }) {
  const [activeId, setActiveId] = useState(SETUP_STEPS[0].id);
  const active = SETUP_STEPS.find((s) => s.id === activeId) ?? SETUP_STEPS[0];

  return (
    <section className={cn(APP_CARD, "overflow-hidden", monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]")}>
      <div className="border-b border-border/60 px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Recommended next steps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off — connect channels, invite your team, and explore automation.
        </p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr]">
        <div className="border-b border-border/60 p-2 lg:border-b-0 lg:border-r">
          {SETUP_STEPS.map((step) => {
            const selected = step.id === activeId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveId(step.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[10px] px-3 py-3 text-left transition-colors",
                  selected ? "bg-muted/50" : "hover:bg-muted/30",
                )}
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {selected ? (
                    <Circle className="size-4 fill-foreground text-foreground" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{step.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-border/70 text-foreground">
                {active.icon}
              </span>
              <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {active.duration}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{active.title}</h3>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {active.description}
            </p>
          </div>
          <Button
            render={<Link href={active.href} />}
            className={cn(
              "w-fit font-semibold",
              authRadiusClass,
              monochrome && "bg-neutral-900 text-white hover:bg-neutral-800",
            )}
          >
            {active.action}
          </Button>
        </div>
      </div>
    </section>
  );
}
