"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Circle, Mail, MessageSquare, Store, Users } from "lucide-react";
import { AiAgentIcon } from "@/components/icons/ai-agent-icon";
import { Button } from "@/components/ui/button";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { APP_CARD } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";

export type SetupStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  duration: string;
  href: string;
  action: string;
  /** Sub-areas covered by this grouped step */
  includes?: string[];
  done?: boolean;
};

/** Steps can be updated later — total guided time ~10–15 mins. */
export const HOME_SETUP_STEPS: SetupStep[] = [
  {
    id: "email",
    label: "Add email",
    title: "Connect your support email",
    description: "Route customer emails into Agentra so your team can reply from one place.",
    duration: "3 mins",
    href: "/settings?item=email",
    action: "Connect email",
  },
  {
    id: "store",
    label: "Connect store",
    title: "Link your store",
    description: "Pull orders and customer context into conversations for faster support.",
    duration: "3 mins",
    href: "/settings?item=store",
    action: "Connect store",
  },
  {
    id: "team",
    label: "Invite teammates",
    title: "Invite your support team",
    description: "Add agents and admins so conversations can be assigned and tracked.",
    duration: "3 mins",
    href: "/settings?item=users",
    action: "Invite teammates",
  },
  {
    id: "automate",
    label: "Automate support",
    title: "Turn on the AI Agent",
    description: "Let AI handle common questions across live chat and other channels you enable.",
    duration: "4 mins",
    href: "/settings?item=ai-agent",
    action: "Configure AI Agent",
  },
];

const STEP_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="size-4" />,
  store: <Store className="size-4" />,
  team: <Users className="size-4" />,
  automate: <AiAgentIcon className="size-4" />,
  chat: <MessageSquare className="size-4" />,
};

type HomeSetupPanelProps = {
  monochrome?: boolean;
  onSkip?: () => void;
  steps?: SetupStep[];
};

export function HomeSetupPanel({
  monochrome = false,
  onSkip,
  steps = HOME_SETUP_STEPS,
}: HomeSetupPanelProps) {
  const firstOpen = steps.find((s) => !s.done)?.id ?? steps[0]?.id;
  const [activeId, setActiveId] = useState(firstOpen);
  const active = steps.find((s) => s.id === activeId) ?? steps[0];
  const doneCount = steps.filter((s) => s.done).length;
  const totalMins = steps.reduce((sum, s) => {
    const n = parseInt(String(s.duration).replace(/\D/g, ""), 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  if (!active) return null;

  return (
    <section
      className={cn(
        APP_CARD,
        "overflow-hidden",
        monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Get set up</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            About {totalMins || "10–15"} mins · {doneCount}/{steps.length} complete
          </p>
        </div>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now
          </button>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-[240px_1fr]">
        <div className="border-b border-border/60 p-2 lg:border-b-0 lg:border-r">
          {steps.map((step) => {
            const selected = step.id === activeId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveId(step.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-muted/60" : "hover:bg-muted/30",
                )}
              >
                <span className="shrink-0 text-muted-foreground">
                  {step.done ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Circle className="size-5" strokeWidth={1.5} />
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    selected || step.done ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-[10px] border border-border/70 text-foreground">
                {STEP_ICONS[active.id] ?? <Circle className="size-4" />}
              </span>
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-100">
                {active.duration}
              </span>
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{active.title}</h3>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {active.description}
            </p>
          </div>
          <Button
            render={<Link href={active.href} />}
            className={cn(
              "w-fit gap-1.5 font-semibold",
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
