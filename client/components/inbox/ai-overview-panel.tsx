"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
  History,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ticketAiApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type {
  CustomerAiProfile,
  CustomerTimelineEvent,
  SupportIncidentSummary,
  Ticket,
  TicketAiIntelligence,
  TicketAiSimilarTicket,
  TicketMergeCandidate,
  TicketOpsSla,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AiOverviewPanelProps = {
  ticket: Ticket;
  onIntelligenceUpdated?: (intelligence: TicketAiIntelligence | null, meta?: Partial<Ticket>) => void;
  onUseSuggestedReply?: (reply: string) => void;
};

function severityClass(severity?: string) {
  switch (severity) {
    case "critical":
    case "high":
      return "text-destructive";
    case "medium":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

function formatWhen(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function AiOverviewPanel({
  ticket,
  onIntelligenceUpdated,
  onUseSuggestedReply,
}: AiOverviewPanelProps) {
  const [intelligence, setIntelligence] = useState<TicketAiIntelligence | null>(
    ticket.aiIntelligence ?? null,
  );
  const [profile, setProfile] = useState<CustomerAiProfile | null>(null);
  const [timeline, setTimeline] = useState<CustomerTimelineEvent[]>([]);
  const [similar, setSimilar] = useState<TicketAiSimilarTicket[]>([]);
  const [sla, setSla] = useState<TicketOpsSla | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<TicketMergeCandidate[]>([]);
  const [incident, setIncident] = useState<SupportIncidentSummary | null>(null);
  const [mergingCode, setMergingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    setIntelligence(ticket.aiIntelligence ?? null);
    setSimilar(ticket.aiIntelligence?.similarTickets ?? []);
    setSignalsOpen(false);
    setTimelineOpen(false);
  }, [ticket._id, ticket.aiIntelligence]);

  const loadCustomerIntel = useCallback(async () => {
    try {
      const { data } = await ticketAiApi.getCustomerIntelligence(ticket.ticket_code);
      setProfile((data.data.profile as CustomerAiProfile) || null);
      setTimeline((data.data.timeline as CustomerTimelineEvent[]) || []);
      const similarFromApi = (data.data.similarTickets as TicketAiSimilarTicket[]) || [];
      if (similarFromApi.length) setSimilar(similarFromApi);
    } catch {
      // Non-blocking
    }
  }, [ticket.ticket_code]);

  const loadOpsIntel = useCallback(async () => {
    try {
      const { data } = await ticketAiApi.getOpsIntelligence(ticket.ticket_code);
      setSla((data.data.sla as TicketOpsSla) || null);
      setMergeCandidates((data.data.mergeCandidates as TicketMergeCandidate[]) || []);
      setIncident((data.data.incident as SupportIncidentSummary) || null);
    } catch {
      // Non-blocking
    }
  }, [ticket.ticket_code]);

  const mergeIntoCurrent = async (sourceCode: string) => {
    setMergingCode(sourceCode);
    try {
      await ticketAiApi.mergeTicket(ticket.ticket_code, sourceCode);
      toast.success(`Merged ${sourceCode} into this ticket`);
      setMergeCandidates((prev) => prev.filter((c) => c.ticketCode !== sourceCode));
      await loadOpsIntel();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Merge failed");
      toast.error(message);
    } finally {
      setMergingCode(null);
    }
  };

  const refresh = useCallback(
    async (force = true) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        if (force) {
          const { data } = await ticketAiApi.refreshIntelligence(ticket.ticket_code);
          const next = (data.data.aiIntelligence as TicketAiIntelligence) || null;
          setIntelligence(next);
          setSimilar(next?.similarTickets ?? []);
          onIntelligenceUpdated?.(next);
          if (data.data.assignment && !data.data.assignment.skipped) {
            toast.success(`Assigned to ${data.data.assignment.assignedAgentName || "an agent"}`);
          }
        } else {
          const { data } = await ticketAiApi.getIntelligence(ticket.ticket_code);
          const next = (data.data.aiIntelligence as TicketAiIntelligence) || null;
          setIntelligence(next);
          setSimilar(next?.similarTickets ?? []);
          onIntelligenceUpdated?.(next, {
            priority: data.data.priority,
            tags: data.data.tags,
            details: data.data.details,
          });
        }
        await loadCustomerIntel();
        await loadOpsIntel();
      } catch (err: unknown) {
        const { message } = getApiError(err, "Could not load AI overview");
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ticket.ticket_code, onIntelligenceUpdated, loadCustomerIntel, loadOpsIntel],
  );

  useEffect(() => {
    void refresh(false);
  }, [ticket._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent =
    intelligence &&
    (intelligence.summary ||
      intelligence.recommendedAction?.label ||
      intelligence.risks?.length ||
      intelligence.suggestedReply ||
      intelligence.contradictions?.length ||
      intelligence.customerWant ||
      intelligence.handoffReason);

  const risks = intelligence?.risks || [];
  const contradictions = intelligence?.contradictions || [];
  const signalCount =
    risks.length +
    contradictions.length +
    (sla ? 1 : 0) +
    (incident ? 1 : 0);
  const hasCriticalSignal = [...risks, ...contradictions].some((r) =>
    ["critical", "high"].includes(String(r.severity || "")),
  );

  return (
    <section className="border-b border-border/60">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          AI Overview
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={refreshing || loading}
          onClick={() => void refresh(true)}
          aria-label="Refresh AI overview"
        >
          {refreshing || loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </Button>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {loading && !hasContent ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : !hasContent ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
            No AI overview yet. Refresh after handoff or when the conversation has enough context.
          </p>
        ) : (
          <>
            {/* 1. What to handle */}
            <div className="space-y-3">
              {intelligence?.summary ? (
                <div>
                  <SectionLabel>Main issue</SectionLabel>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{intelligence.summary}</p>
                </div>
              ) : null}

              {intelligence?.customerWant ? (
                <div>
                  <SectionLabel>Customer wants</SectionLabel>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">
                    {intelligence.customerWant}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {intelligence?.sentiment && intelligence.sentiment !== "unknown" ? (
                  <Badge variant="secondary" className="capitalize">
                    {intelligence.sentiment}
                  </Badge>
                ) : null}
                {intelligence?.urgency && intelligence.urgency !== "unknown" ? (
                  <Badge variant="secondary" className="capitalize">
                    Urgency: {intelligence.urgency}
                  </Badge>
                ) : null}
                {intelligence?.intent ? (
                  <Badge variant="outline" className="capitalize">
                    {intelligence.intent.replace(/_/g, " ")}
                  </Badge>
                ) : null}
                {intelligence?.waitingOn &&
                intelligence.waitingOn !== "none" &&
                intelligence.waitingOn !== "" ? (
                  <Badge variant="outline" className="capitalize">
                    Waiting: {intelligence.waitingOn.replace(/_/g, " ")}
                  </Badge>
                ) : null}
              </div>
            </div>

            {/* 2. Next step for the agent */}
            {intelligence?.recommendedAction &&
            intelligence.recommendedAction.type &&
            intelligence.recommendedAction.type !== "none" ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                      Do next
                      {intelligence.recommendedAction.confidence
                        ? ` · ${intelligence.recommendedAction.confidence}%`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {intelligence.recommendedAction.label ||
                        intelligence.recommendedAction.type.replace(/_/g, " ")}
                    </p>
                    {intelligence.recommendedAction.reason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {intelligence.recommendedAction.reason}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {intelligence?.suggestedReply ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <SectionLabel>Suggested reply</SectionLabel>
                  {onUseSuggestedReply ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onUseSuggestedReply(intelligence.suggestedReply || "")}
                    >
                      Use in composer
                    </Button>
                  ) : null}
                </div>
                <p className="line-clamp-6 whitespace-pre-wrap rounded-lg border border-border/60 bg-background px-3 py-2 text-xs leading-relaxed text-foreground">
                  {intelligence.suggestedReply}
                </p>
              </div>
            ) : null}

            {(intelligence?.handoffReason || intelligence?.actionsAlreadyTried?.length) ? (
              <div className="space-y-2.5 border-t border-border/50 pt-3">
                {intelligence?.handoffReason ? (
                  <div>
                    <SectionLabel>Why handed over</SectionLabel>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {intelligence.handoffReason}
                    </p>
                  </div>
                ) : null}
                {intelligence?.actionsAlreadyTried?.length ? (
                  <div>
                    <SectionLabel>Already tried</SectionLabel>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {intelligence.actionsAlreadyTried.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 3. Useful context */}
            {mergeCandidates.length ? (
              <div className="border-t border-border/50 pt-3">
                <SectionLabel>Merge suggestions</SectionLabel>
                <ul className="mt-2 space-y-2">
                  {mergeCandidates.map((candidate) => (
                    <li
                      key={candidate.ticketCode}
                      className="rounded-lg border border-border/60 bg-background px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">
                            {candidate.ticketCode}: {candidate.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {candidate.reason}
                            {candidate.source ? ` · ${candidate.source}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 text-xs"
                          disabled={mergingCode === candidate.ticketCode}
                          onClick={() =>
                            candidate.ticketCode ? void mergeIntoCurrent(candidate.ticketCode) : undefined
                          }
                        >
                          {mergingCode === candidate.ticketCode ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Merge in"
                          )}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {profile?.available ? (
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Customer profile
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Loyalty</p>
                    <p className="font-medium capitalize">{profile.loyaltyLevel || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Orders</p>
                    <p className="font-medium">{profile.totalOrders ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Spend</p>
                    <p className="font-medium">
                      {profile.currency || "USD"} {profile.totalSpend ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open tickets</p>
                    <p className="font-medium">{profile.openTickets ?? 0}</p>
                  </div>
                </div>
                {profile.productsPurchased?.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Products: {profile.productsPurchased.slice(0, 4).join(", ")}
                    {profile.productsPurchased.length > 4 ? "…" : ""}
                  </p>
                ) : null}
                {profile.unresolvedIssues?.length ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Unresolved</p>
                    {profile.unresolvedIssues.slice(0, 3).map((issue) => (
                      <Link
                        key={issue.ticketCode}
                        href={`/inbox?ticket=${issue.ticketCode}`}
                        className="block truncate text-xs text-primary hover:underline"
                      >
                        {issue.ticketCode}: {issue.title}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {similar.length ? (
              <div className="border-t border-border/50 pt-3">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <History className="size-3.5" />
                    Similar resolved
                  </span>
                </SectionLabel>
                <ul className="mt-2 space-y-2">
                  {similar.slice(0, 3).map((item) => (
                    <li key={item.ticketCode} className="text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/inbox?ticket=${item.ticketCode}`}
                          className="truncate font-medium text-primary hover:underline"
                        >
                          {item.ticketCode}: {item.title}
                        </Link>
                        {item.similarity != null ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {item.similarity}%
                          </span>
                        ) : null}
                      </div>
                      {item.outcome ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {item.outcome}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {timeline.length ? (
              <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setTimelineOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Clock3 className="size-3.5 shrink-0" />
                    <span className="truncate">Timeline</span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground ring-1 ring-border/60">
                      {Math.min(timeline.length, 8)}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {timelineOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </span>
                </button>
                {timelineOpen ? (
                  <ul className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5 pl-1">
                    {timeline.slice(0, 8).map((event, i) => (
                      <li key={`${event.ref}-${i}`} className="relative border-l border-border/70 pl-3 text-xs">
                        <span className="absolute -left-[3px] top-1.5 size-1.5 rounded-full bg-muted-foreground/50" />
                        <p className="font-medium text-foreground">{event.title}</p>
                        {event.detail ? (
                          <p className="line-clamp-2 text-muted-foreground">{event.detail}</p>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground/80">{formatWhen(event.at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {signalCount > 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSignalsOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <AlertTriangle
                      className={cn(
                        "size-3.5 shrink-0",
                        hasCriticalSignal ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">Risks & signals</span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground ring-1 ring-border/60">
                      {signalCount}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {signalsOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </span>
                </button>

                {signalsOpen ? (
                  <ul className="mt-2.5 space-y-1.5 border-t border-border/50 pt-2.5">
                    {risks.map((risk, i) => (
                      <li key={`risk-${risk.type}-${i}`} className="text-xs">
                        <p className={cn("font-medium capitalize", severityClass(risk.severity))}>
                          {(risk.type || "risk").replace(/_/g, " ")}
                          {risk.severity ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {risk.severity}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">{risk.message}</p>
                      </li>
                    ))}
                    {contradictions.map((item, i) => (
                      <li key={`contra-${item.type}-${i}`} className="text-xs">
                        <p className={cn("font-medium", severityClass(item.severity))}>
                          Contradiction
                          {item.severity ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {item.severity}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">{item.message}</p>
                      </li>
                    ))}
                    {incident ? (
                      <li className="text-xs">
                        <p className="font-medium text-foreground">
                          {incident.title || "Incident spike"}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">
                          {incident.summary ||
                            `${incident.ticketCount || 0} related tickets in the recent window.`}
                        </p>
                      </li>
                    ) : null}
                    {sla ? (
                      <li className="text-xs">
                        <p
                          className={cn(
                            "font-medium",
                            (sla.probability || 0) >= 70 ? "text-destructive" : "text-foreground",
                          )}
                        >
                          SLA risk
                          {sla.probability != null ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {sla.probability}%
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 leading-relaxed text-muted-foreground">{sla.message}</p>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {intelligence?.sources?.length ? (
              <p className="text-[11px] text-muted-foreground/80">
                Sources: {intelligence.sources.join(", ")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
