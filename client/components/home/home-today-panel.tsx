"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { APP_CARD } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";

export type HomeTodayStats = {
  assigned: number;
  unassigned: number;
  open: number;
  loading?: boolean;
};

type Reminder = {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  done?: boolean;
};

type HomeTodayPanelProps = {
  variant: "admin" | "agent";
  stats: HomeTodayStats;
  monochrome?: boolean;
};

function buildAdminReminders(stats: HomeTodayStats): Reminder[] {
  const reminders: Reminder[] = [];

  if (stats.unassigned > 0) {
    reminders.push({
      id: "unassigned",
      title:
        stats.unassigned === 1
          ? "1 conversation is waiting without an owner"
          : `${stats.unassigned} conversations are waiting without an owner`,
      detail: "Assign them so customers aren’t left hanging.",
      href: "/inbox?view=all",
      action: "Assign now",
    });
  }

  if (stats.open > 0) {
    reminders.push({
      id: "open",
      title:
        stats.open === 1
          ? "Check in on your open queue"
          : `Check in on ${stats.open} open conversations`,
      detail: "Skim for anything that needs a nudge today.",
      href: "/inbox?view=all",
      action: "Review inbox",
    });
  }

  if (stats.assigned > 0) {
    reminders.push({
      id: "with-agents",
      title: "Glance at work already with agents",
      detail:
        stats.assigned === 1
          ? "1 ticket is being handled — make sure it’s on track."
          : `${stats.assigned} tickets are with the team — make sure nothing’s stuck.`,
      href: "/inbox?view=all",
      action: "Take a look",
    });
  }

  if (reminders.length === 0) {
    reminders.push({
      id: "clear",
      title: "You’re clear for now",
      detail: "No unassigned or open work needs a review yet.",
      href: "/inbox",
      action: "Open inbox",
      done: true,
    });
  }

  return reminders.slice(0, 3);
}

function buildAgentReminders(stats: HomeTodayStats): Reminder[] {
  const reminders: Reminder[] = [];

  if (stats.assigned > 0) {
    reminders.push({
      id: "assigned",
      title:
        stats.assigned === 1
          ? "You have 1 conversation assigned to you"
          : `You have ${stats.assigned} conversations assigned to you`,
      detail: "Jump in and keep customers moving.",
      href: "/inbox?view=assigned",
      action: "Open assigned",
    });
  } else {
    reminders.push({
      id: "none-assigned",
      title: "No conversations assigned to you yet",
      detail: "When something lands on you, it’ll show up here.",
      href: "/inbox?view=assigned",
      action: "Check inbox",
      done: true,
    });
  }

  reminders.push({
    id: "notifications",
    title: "Keep alerts on for new assignments",
    detail: "So you don’t miss work that comes in while you’re away.",
    href: "/settings?item=notifications",
    action: "Review alerts",
  });

  return reminders.slice(0, 3);
}

export function HomeTodayPanel({ variant, stats, monochrome = false }: HomeTodayPanelProps) {
  const isAdmin = variant === "admin";
  const reminders = isAdmin ? buildAdminReminders(stats) : buildAgentReminders(stats);
  const pendingCount = reminders.filter((r) => !r.done).length;

  return (
    <section
      className={cn(
        APP_CARD,
        "overflow-hidden",
        monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {isAdmin ? "Reminders for today" : "Your reminders"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.loading
              ? "Loading…"
              : pendingCount > 0
                ? `${pendingCount} thing${pendingCount === 1 ? "" : "s"} worth checking`
                : "Nothing urgent — nice work."}
          </p>
        </div>
      </div>

      <div className="p-2 sm:p-3">
        {stats.loading ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading reminders…
          </div>
        ) : (
          <ul className="space-y-1">
            {reminders.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-[10px] px-3 py-3 transition-colors",
                    "hover:bg-muted/50",
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-muted-foreground">
                    {item.done ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                        <Check className="size-3" strokeWidth={2.5} />
                      </span>
                    ) : (
                      <Circle className="size-5" strokeWidth={1.5} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium text-foreground",
                        item.done && "text-muted-foreground",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                  </div>

                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground opacity-80 transition-opacity group-hover:opacity-100">
                    {item.action}
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
