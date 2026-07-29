"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { APP_INNER_TILE } from "@/lib/app-surfaces";
import {
  formatAverageRating,
  LIVE_CHAT_RATING_OPTIONS,
  ratingOption,
} from "@/lib/live-chat-rating";
import { formatUserDisplayName, userInitials } from "@/lib/user-display";
import { cn } from "@/lib/utils";
import type { LiveChatRatingRecord, LiveChatRatingSummary } from "@/lib/types";

export function RatingDistributionBars({
  summary,
  compact = false,
}: {
  summary: LiveChatRatingSummary;
  compact?: boolean;
}) {
  const max = Math.max(...LIVE_CHAT_RATING_OPTIONS.map((o) => summary.distribution[o.value] || 0), 1);

  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {[...LIVE_CHAT_RATING_OPTIONS].reverse().map((option) => {
        const count = summary.distribution[option.value] || 0;
        return (
          <li key={option.value} className="flex items-center gap-2.5">
            <span className="w-5 text-center text-base leading-none" title={option.label}>
              {option.emoji}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(count ? 6 : 0, (count / max) * 100)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AgentCsatOverview({
  summary,
  loading,
  emptyLabel = "No customer ratings yet for this agent.",
}: {
  summary: LiveChatRatingSummary | null;
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary || summary.totalRatings === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(APP_INNER_TILE, "p-3")}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Average
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatAverageRating(summary.averageRating)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/ 5</span>
          </p>
        </div>
        <div className={cn(APP_INNER_TILE, "p-3")}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ratings
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {summary.totalRatings}
          </p>
        </div>
      </div>
      <RatingDistributionBars summary={summary} />
    </div>
  );
}

export function AgentCsatRecords({
  records,
  emptyLabel = "No rated conversations yet.",
}: {
  records: LiveChatRatingRecord[];
  emptyLabel?: string;
}) {
  if (!records.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
      {records.map((record) => {
        const option = ratingOption(record.rating);
        const code = record.ticket?.ticket_code;
        return (
          <li
            key={record._id}
            className={cn(APP_INNER_TILE, "flex items-start justify-between gap-3 px-3 py-2.5")}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{option?.emoji ?? "•"}</span>
                <p className="truncate text-sm font-medium text-foreground">
                  {option?.label ?? `Rating ${record.rating}`}
                </p>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {code ? (
                  <Link href={`/tickets/${code}`} className="hover:text-foreground hover:underline">
                    {code}
                  </Link>
                ) : (
                  "Conversation"
                )}
                {record.ticket?.ticket_title ? ` · ${record.ticket.ticket_title}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {record.submittedAt
                ? new Date(record.submittedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AgentAvatar({
  agent,
  className,
}: {
  agent?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    fullName?: string;
  } | null;
  className?: string;
}) {
  const name = formatUserDisplayName(
    {
      firstName: agent?.firstName || "",
      lastName: agent?.lastName || "",
      fullName: agent?.fullName || "",
      email: agent?.email || "",
    },
    "Agent",
  );
  return (
    <Avatar className={cn("size-8", className)}>
      {agent?.avatar ? <AvatarImage src={agent.avatar} alt={name} /> : null}
      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
        {userInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
