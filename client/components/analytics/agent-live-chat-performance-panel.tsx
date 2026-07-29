"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Star } from "lucide-react";
import {
  AgentAvatar,
  AgentCsatRecords,
  RatingDistributionBars,
} from "@/components/analytics/agent-csat-shared";
import { usersApi } from "@/lib/api";
import { APP_CARD, APP_INNER_TILE, APP_SECTION_LABEL } from "@/lib/app-surfaces";
import { formatAverageRating, emptyRatingSummary } from "@/lib/live-chat-rating";
import { formatUserDisplayName } from "@/lib/user-display";
import { cn } from "@/lib/utils";
import type { WorkspaceLiveChatEvaluation } from "@/lib/types";

export default function AgentLiveChatPerformancePanel() {
  const [data, setData] = useState<WorkspaceLiveChatEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    usersApi
      .liveChatEvaluations()
      .then((res) => {
        if (!cancelled) setData(res.data.data as WorkspaceLiveChatEvaluation);
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            summary: emptyRatingSummary(),
            agents: [],
            recent: [],
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary ?? emptyRatingSummary();
  const agents = data?.agents ?? [];
  const recent = data?.recent ?? [];

  return (
    <section className={cn(APP_CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <Star className="size-4 text-foreground" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Agent live chat performance</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Customer emoji ratings after conversations are marked solved
            </p>
          </div>
        </div>
        <Link
          href="/settings?item=users"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open users
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="space-y-5 p-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={cn(APP_INNER_TILE, "p-4")}>
                <p className={APP_SECTION_LABEL}>Workspace average</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatAverageRating(summary.averageRating)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">/ 5</span>
                </p>
              </div>
              <div className={cn(APP_INNER_TILE, "p-4")}>
                <p className={APP_SECTION_LABEL}>Total ratings</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {summary.totalRatings}
                </p>
              </div>
              <div className={cn(APP_INNER_TILE, "p-4")}>
                <p className={APP_SECTION_LABEL}>Agents rated</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {summary.agentsRated ?? agents.length}
                </p>
              </div>
            </div>

            {summary.totalRatings === 0 ? (
              <div className={cn(APP_INNER_TILE, "px-4 py-10 text-center")}>
                <p className="text-sm font-medium text-foreground">No live chat ratings yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  When agents resolve live chats and customers leave feedback, performance will show
                  here.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className={APP_SECTION_LABEL}>Score distribution</p>
                  <div className={cn(APP_INNER_TILE, "p-4")}>
                    <RatingDistributionBars summary={summary} />
                  </div>

                  <p className={cn(APP_SECTION_LABEL, "pt-2")}>By agent</p>
                  <ul className="space-y-2">
                    {agents.map((row) => (
                      <li
                        key={row.agent._id}
                        className={cn(APP_INNER_TILE, "flex items-center gap-3 px-3 py-2.5")}
                      >
                        <AgentAvatar agent={row.agent} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {formatUserDisplayName({
                              firstName: row.agent.firstName,
                              lastName: row.agent.lastName,
                              email: row.agent.email,
                              fullName: "",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.summary.totalRatings} rating
                            {row.summary.totalRatings === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatAverageRating(row.summary.averageRating)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">avg / 5</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className={APP_SECTION_LABEL}>Recent feedback</p>
                  <AgentCsatRecords
                    records={recent}
                    emptyLabel="No recent feedback records."
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
