"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocalTime } from "@/hooks/use-user-local-time";
import { ticketApi } from "@/lib/api";
import { Ticket as TicketType } from "@/lib/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { AppCard, AppCardBody, AppCardHeader } from "@/components/app/app-card";
import { AppEmptyState, AppListDivider, AppListRowLink } from "@/components/app/app-list-row";
import { HomeSetupReminders } from "@/components/home/home-setup-reminders";
import { HomeTodayPanel, type HomeTodayStats } from "@/components/home/home-today-panel";
import { HomeResourceCards } from "@/components/home/home-resource-cards";
import {
  fetchWorkspaceSetupStatus,
  type WorkspaceSetupStatus,
} from "@/lib/home-setup-status";

const MONO_BADGE = "border border-neutral-200 bg-neutral-100 text-neutral-700";
const DASHBOARD_CARD = "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

export default function HomePage() {
  const { user } = useAuth();
  const { greeting } = useUserLocalTime();
  const [recent, setRecent] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [todayStats, setTodayStats] = useState<HomeTodayStats>({
    assigned: 0,
    unassigned: 0,
    open: 0,
    loading: true,
  });
  const [setupStatus, setSetupStatus] = useState<WorkspaceSetupStatus>({
    steps: [],
    remaining: [],
    doneCount: 0,
    totalMinsRemaining: 0,
    loading: true,
  });

  const role = user?.role ?? "customer";
  const isWorkspaceAdmin = ["owner", "admin"].includes(role);
  const isManager = role === "manager";
  const isAgent = role === "agent";
  const showSetupReminders =
    isWorkspaceAdmin && (setupStatus.loading || setupStatus.remaining.length > 0);
  const showToday = isAgent || isWorkspaceAdmin || isManager;

  const loadRecent = async () => {
    try {
      const ticketsRes = await ticketApi.list({ limit: 5, scope: "dashboard" });
      setRecent(ticketsRes.data.data.tickets);
    } catch {
      /* ignore */
    }
  };

  const loadTodayStats = async () => {
    setTodayStats((prev) => ({ ...prev, loading: true }));
    try {
      const [{ data: countsRes }, { data: listRes }] = await Promise.all([
        ticketApi.inboxCounts("inbox"),
        ticketApi.list({ limit: 50, scope: "inbox", view: isAgent ? "assigned" : "all" }),
      ]);
      const counts = countsRes.data.counts ?? {};
      const tickets = (listRes.data.tickets ?? []) as TicketType[];
      const unassigned = tickets.filter((t) => !t.assigned_agent).length;
      const assigned =
        isAgent
          ? Number(counts.assigned ?? tickets.length)
          : tickets.filter((t) => Boolean(t.assigned_agent)).length;

      setTodayStats({
        assigned,
        unassigned: isAgent ? 0 : unassigned,
        open: Number(counts.all ?? counts.assigned ?? tickets.length),
        loading: false,
      });
    } catch {
      setTodayStats({ assigned: 0, unassigned: 0, open: 0, loading: false });
    }
  };

  const loadSetupStatus = async () => {
    if (!isWorkspaceAdmin) {
      setSetupStatus({
        steps: [],
        remaining: [],
        doneCount: 0,
        totalMinsRemaining: 0,
        loading: false,
      });
      return;
    }
    setSetupStatus((prev) => ({ ...prev, loading: true }));
    try {
      const status = await fetchWorkspaceSetupStatus();
      setSetupStatus({ ...status, loading: false });
    } catch {
      setSetupStatus({
        steps: [],
        remaining: [],
        doneCount: 0,
        totalMinsRemaining: 0,
        loading: false,
      });
    }
  };

  const loadDemoData = async () => {
    setLoadingDemo(true);
    try {
      const { data } = await ticketApi.createDemo();
      const payload = data.data;
      toast.success(
        `Demo data ready: ${payload.inboxCount ?? 20} inbox + ${payload.liveChatCount ?? payload.aiAgentCount ?? 20} AI Agent conversations (${payload.created ?? 0} new)`,
      );
      await Promise.all([loadRecent(), loadTodayStats(), loadSetupStatus()]);
    } catch {
      toast.error("Could not load demo data");
    } finally {
      setLoadingDemo(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      await Promise.all([loadRecent(), loadTodayStats(), loadSetupStatus()]);
      if (!cancelled) setLoading(false);
    };
    void loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role-gated home fetch
  }, [isAgent, isWorkspaceAdmin, isManager]);

  return (
    <div className="dashboard-monochrome w-full space-y-8 text-neutral-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {greeting}, {user?.firstName}
        </h1>
        <p className="text-sm text-neutral-500">Your workspace overview and quick actions.</p>
      </div>

      {showSetupReminders ? (
        <HomeSetupReminders
          monochrome
          loading={setupStatus.loading}
          steps={setupStatus.steps}
          remaining={setupStatus.remaining}
          doneCount={setupStatus.doneCount}
          totalCount={setupStatus.steps.length || 5}
          totalMinsRemaining={setupStatus.totalMinsRemaining}
        />
      ) : null}

      {showToday ? (
        <HomeTodayPanel
          monochrome
          variant={isAgent ? "agent" : "admin"}
          stats={todayStats}
        />
      ) : null}

      <HomeResourceCards monochrome />

      <AppCard className={DASHBOARD_CARD}>
        <AppCardHeader
          title="Recent conversations"
          action={
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:underline"
            >
              Open inbox <ChevronRight className="size-3" />
            </Link>
          }
        />
        <AppCardBody>
          {loading ? (
            <AppEmptyState>Loading conversations…</AppEmptyState>
          ) : recent.length === 0 ? (
            <AppEmptyState>
              <div className="space-y-3">
                <p>No conversations yet</p>
                {isWorkspaceAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingDemo}
                    onClick={() => void loadDemoData()}
                  >
                    {loadingDemo ? (
                      <>
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                        Loading demo data…
                      </>
                    ) : (
                      "Load demo data (20 inbox + 20 AI Agent)"
                    )}
                  </Button>
                ) : null}
              </div>
            </AppEmptyState>
          ) : (
            recent.map((t, i) => (
              <div key={t._id}>
                {i > 0 ? <AppListDivider /> : null}
                <AppListRowLink
                  href={`/inbox?ticket=${t.ticket_code}`}
                  className="hover:bg-neutral-100"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-xs font-semibold text-neutral-700">
                      {t.ticket_code}
                    </span>
                    <span className="truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                      {t.ticket_title}
                    </span>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Badge className={MONO_BADGE} variant="secondary">
                      {PRIORITY_LABELS[t.priority]}
                    </Badge>
                    <Badge className={MONO_BADGE} variant="secondary">
                      {STATUS_LABELS[t.status]}
                    </Badge>
                  </div>
                </AppListRowLink>
              </div>
            ))
          )}
        </AppCardBody>
      </AppCard>

    </div>
  );
}
