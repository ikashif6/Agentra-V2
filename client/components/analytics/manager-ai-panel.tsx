"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { helpdeskAiApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { APP_CARD, APP_INNER_TILE, APP_SECTION_LABEL } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";
import type { ManagerIntelligence } from "@/lib/types";

const SEVERITY_DOT: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  info: "bg-muted-foreground/50",
};

const ACTION_LABELS: Record<string, string> = {
  apology_only: "Apology",
  small_discount: "Small discount",
  free_shipping: "Free shipping",
  replacement_or_refund: "Replacement / refund",
  manager_intervention: "Manager intervention",
  no_compensation: "No compensation",
};

function scoreTone(score?: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-foreground";
  return "text-amber-600 dark:text-amber-400";
}

export default function ManagerAiPanel() {
  const [data, setData] = useState<ManagerIntelligence | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await helpdeskAiApi.getManagerIntelligence();
      setData((res.data.managerAi as ManagerIntelligence) || null);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load Manager AI");
      toast.error(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={cn(APP_CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <Sparkles className="size-4 text-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Manager AI</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              QA scores, coaching, volume signals, and churn recovery
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-14">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          Manager intelligence is unavailable. Enable toggles under Settings → Helpdesk AI.
        </p>
      ) : (
        <div className="space-y-6 p-5">
          {data.feed ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className={APP_SECTION_LABEL}>Intelligence feed</p>
                <p className="text-xs text-muted-foreground">
                  {data.feed.createdNow ?? 0} tickets ·{" "}
                  {(data.feed.volumeDelta ?? 0) >= 0 ? "+" : ""}
                  {data.feed.volumeDelta ?? 0}% vs prior {data.feed.days ?? 7}d
                </p>
              </div>
              {(data.feed.findings || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No manager findings in this window.</p>
              ) : (
                <ul className="space-y-2">
                  {(data.feed.findings || []).slice(0, 6).map((f, i) => (
                    <li
                      key={`${f.type}-${f.title}-${i}`}
                      className={cn(APP_INNER_TILE, "flex gap-3 px-3 py-2.5")}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          SEVERITY_DOT[f.severity || "info"] || SEVERITY_DOT.info,
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{f.title}</p>
                          {f.ticketCode ? (
                            <Link
                              href={`/inbox?ticket=${f.ticketCode}`}
                              className="inline-flex items-center text-xs text-primary hover:underline"
                            >
                              {f.ticketCode}
                              <ChevronRight className="size-3" />
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{f.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <p className={APP_SECTION_LABEL}>Agent coaching</p>
              {(data.coaching || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Coaching appears after closed tickets receive QA scores.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data.coaching || []).slice(0, 5).map((row) => (
                    <li key={row.agentId || row.agentName} className={cn(APP_INNER_TILE, "p-3")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium text-foreground">
                            {row.agentName || "Agent"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            scoreTone(row.overallAvg),
                          )}
                        >
                          {row.overallAvg != null ? row.overallAvg : "—"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {row.recommendation}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.scoredTickets ?? 0} scored · {row.needsReviewCount ?? 0} need review
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <p className={APP_SECTION_LABEL}>Recent QA</p>
              {(data.recentQa || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Resolve tickets to generate automatic quality scores.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(data.recentQa || []).slice(0, 5).map((row) => (
                    <li
                      key={row.ticketCode}
                      className={cn(APP_INNER_TILE, "flex items-start justify-between gap-3 p-3")}
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/inbox?ticket=${row.ticketCode}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {row.ticketCode}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {row.summary || row.title}
                        </p>
                        {row.needsManagerReview ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" />
                            Needs review
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          scoreTone(row.overall),
                        )}
                      >
                        {row.overall != null ? row.overall : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.rootCause ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-3.5 text-muted-foreground" />
                <p className={APP_SECTION_LABEL}>Root cause</p>
              </div>
              <div className={cn(APP_INNER_TILE, "space-y-2 p-4")}>
                <p className="text-sm leading-relaxed text-foreground">{data.rootCause.narrative}</p>
                {data.rootCause.recommendedFocus ? (
                  <p className="text-xs text-muted-foreground">
                    Focus: {data.rootCause.recommendedFocus}
                  </p>
                ) : null}
                {(data.rootCause.topics || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(data.rootCause.topics || []).slice(0, 5).map((t) => (
                      <span
                        key={t.topic}
                        className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {t.topic} · {t.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {(data.churn || []).length > 0 ? (
            <div className="space-y-3">
              <p className={APP_SECTION_LABEL}>Churn recovery</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(data.churn || []).slice(0, 6).map((row) => (
                  <li key={row.email} className={cn(APP_INNER_TILE, "p-3")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.name || row.email}
                      </p>
                      <span className="shrink-0 rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ACTION_LABELS[row.action || ""] || row.action || "Review"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.openTickets ?? 0} open · {row.loyaltyLevel || "customer"}
                      {row.totalSpend != null ? ` · $${Math.round(row.totalSpend)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Configure Manager AI features in{" "}
            <Link href="/settings?item=helpdesk-ai" className="text-primary hover:underline">
              Settings → Helpdesk AI
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}
