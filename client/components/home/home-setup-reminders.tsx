"use client";

import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_CARD } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";
import type { SetupStep } from "@/components/home/home-setup-panel";

type HomeSetupRemindersProps = {
  steps: SetupStep[];
  remaining: SetupStep[];
  doneCount: number;
  totalCount: number;
  totalMinsRemaining: number;
  loading?: boolean;
  monochrome?: boolean;
};

export function HomeSetupReminders({
  steps,
  remaining,
  doneCount,
  totalCount,
  totalMinsRemaining,
  loading = false,
  monochrome = false,
}: HomeSetupRemindersProps) {
  if (!loading && remaining.length === 0) return null;

  const progressPct =
    totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const timeline = steps.length > 0 ? steps : remaining;

  return (
    <section
      className={cn(
        APP_CARD,
        "overflow-hidden",
        monochrome && "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Finish workspace setup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Checking what’s left…"
              : `${remaining.length} step${remaining.length === 1 ? "" : "s"} left · about ${totalMinsRemaining || 10} mins · ${doneCount}/${totalCount} done`}
          </p>
          {!loading ? (
            <div className="mt-3 h-1 max-w-[200px] overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-foreground/80 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}
        </div>
        <Button
          render={
            <a
              href="https://www.agentraa.com/setup-help"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          variant="outline"
          className={cn(
            "h-9 font-semibold",
            monochrome && "border-neutral-300 text-neutral-900 hover:bg-neutral-100",
          )}
        >
          Get help
        </Button>
      </div>

      <div className="px-5 py-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading setup checklist…
          </div>
        ) : (
          <ol>
            {timeline.map((item, index) => {
              const isLast = index === timeline.length - 1;
              const done = Boolean(item.done);
              return (
                <li key={item.id} className={cn("relative flex gap-4", !isLast && "pb-4")}>
                  <TimelineRail last={isLast} done={done} number={index + 1} />
                  {done ? (
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-xl border px-4 py-3.5",
                        "border-neutral-200 bg-neutral-50/90",
                        monochrome && "border-neutral-200 bg-neutral-100/80",
                      )}
                    >
                      <p className="text-sm font-medium text-muted-foreground line-through decoration-border">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground/80">{item.description}</p>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "group min-w-0 flex-1 rounded-xl border bg-background px-4 py-3.5 transition-colors",
                        "border-border hover:border-foreground/20 hover:bg-muted/30",
                        monochrome && "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground group-hover:underline group-hover:underline-offset-2">
                              {item.title}
                            </p>
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {item.duration}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                          {item.includes?.length ? (
                            <p className="mt-1 text-xs text-muted-foreground/90">
                              {item.includes.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-sm font-medium text-foreground">
                          {item.action}
                          <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </span>
                      </div>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function TimelineRail({
  last,
  done,
  number,
}: {
  last?: boolean;
  done?: boolean;
  number?: number;
}) {
  return (
    <div className="relative flex w-6 shrink-0 flex-col items-center self-stretch">
      {done ? (
        <span className="relative z-[1] flex size-6 items-center justify-center rounded-full border border-border bg-background text-foreground">
          <Check className="size-3" strokeWidth={2.5} />
        </span>
      ) : (
        <span className="relative z-[1] flex size-6 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold tabular-nums text-foreground">
          {number}
        </span>
      )}
      {!last ? (
        <span
          aria-hidden
          className="absolute top-6 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
      ) : null}
    </div>
  );
}
