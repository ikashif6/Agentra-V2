"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { AnalyticsIcon } from "@/components/icons/analytics-icon";
import { useAuth } from "@/contexts/AuthContext";
import { businessHoursApi, ticketApi, usersApi } from "@/lib/api";
import { formatScheduleSummary } from "@/lib/business-hours";
import { STATUS_LABELS } from "@/lib/constants";
import { analyticsSourceLabel } from "@/lib/ticket-source";
import { APP_CARD, APP_INNER_TILE, APP_SECTION_LABEL } from "@/lib/app-surfaces";
import { getUserTimezone } from "@/lib/user-timezone";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

type StatusMap = Record<string, number>;

type BreakdownRow = {
  _id: string;
  name: string;
  count: number;
};

type DashboardData = {
  byStatus: StatusMap;
  byTeam: BreakdownRow[];
  bySource: BreakdownRow[];
};

const PIPELINE_STATUSES = [
  "open",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "self_closed",
] as const;

const PIPELINE_BAR: Record<(typeof PIPELINE_STATUSES)[number], string> = {
  open: "bg-primary",
  in_progress: "bg-primary/75",
  on_hold: "bg-muted-foreground/45",
  resolved: "bg-muted-foreground/65",
  closed: "bg-muted-foreground/35",
  self_closed: "bg-muted-foreground/25",
};

function MetricCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className={cn(APP_CARD, "p-4 sm:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={APP_SECTION_LABEL}>{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border/70 bg-muted/30 text-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  description,
  icon: Icon,
  items,
  emptyLabel,
  loading,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  items: BreakdownRow[];
  emptyLabel: string;
  loading: boolean;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className={cn(APP_CARD, "overflow-hidden")}>
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
          <Icon className="size-4 text-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item._id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function countStaff(users: User[]) {
  const staff = users.filter((user) => ["owner", "admin", "agent"].includes(user.role));
  const online = staff.filter((user) => user.isOnline).length;
  return { staffTotal: staff.length, online };
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { user, company } = useAuth();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [staff, setStaff] = useState({ staffTotal: 0, online: 0 });
  const [hoursSummary, setHoursSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canViewAnalytics = ["owner", "admin"].includes(user?.role ?? "");
  const timezone = getUserTimezone(user, company);

  useEffect(() => {
    if (user && !canViewAnalytics) {
      router.replace("/dashboard");
    }
  }, [user, canViewAnalytics, router]);

  useEffect(() => {
    if (!canViewAnalytics) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [statsRes, hoursRes] = await Promise.all([
          ticketApi.dashboardStats(),
          businessHoursApi.get().catch(() => null),
        ]);

        const membersRes = await usersApi.listWorkspace("", 1, 100).catch(() => null);
        const members = (membersRes?.data?.data?.users ?? []) as User[];
        const staffCounts = countStaff(members);

        if (cancelled) return;

        setStats({
          byStatus: statsRes.data.data.byStatus ?? {},
          byTeam: (statsRes.data.data.byTeam ?? []).map((row: BreakdownRow) => ({
            _id: row._id,
            name: row.name,
            count: row.count,
          })),
          bySource: (statsRes.data.data.bySource ?? []).map((row: BreakdownRow) => ({
            _id: row._id,
            name: analyticsSourceLabel(row._id) || row.name,
            count: row.count,
          })),
        });
        setStaff(staffCounts);

        const defaultHours = hoursRes?.data?.data?.businessHours?.default;
        if (defaultHours?.enabled && defaultHours.schedule) {
          setHoursSummary(
            `${formatScheduleSummary(defaultHours.schedule)} · ${defaultHours.timezone ?? timezone}`,
          );
        } else {
          setHoursSummary(`Workspace timezone · ${timezone}`);
        }
      } catch {
        if (!cancelled) {
          setStats({ byStatus: {}, byTeam: [], bySource: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canViewAnalytics, timezone]);

  const byStatus = stats?.byStatus ?? {};
  const total = useMemo(
    () => Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    [byStatus],
  );
  const open = byStatus.open ?? 0;
  const inProgress = byStatus.in_progress ?? 0;
  const onHold = byStatus.on_hold ?? 0;
  const resolved = (byStatus.resolved ?? 0) + (byStatus.closed ?? 0) + (byStatus.self_closed ?? 0);
  const active = open + inProgress + onHold;

  const pipeline = useMemo(
    () =>
      PIPELINE_STATUSES.map((status) => ({
        status,
        label: STATUS_LABELS[status] ?? status,
        count: byStatus[status] ?? 0,
      })).filter((row) => row.count > 0),
    [byStatus],
  );

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!canViewAnalytics) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workspace overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversation activity for {company?.name ?? "your workspace"} · {todayLabel}
          </p>
        </div>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Open inbox
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard
          label="Total conversations"
          value={loading ? "—" : total}
          icon={<Inbox className="size-[18px]" strokeWidth={1.75} />}
        />
        <MetricCard
          label="Needs attention"
          value={loading ? "—" : active}
          hint="Open, in progress, on hold"
          icon={<Clock className="size-[18px]" strokeWidth={1.75} />}
        />
        <MetricCard
          label="Agents online"
          value={loading ? "—" : `${staff.online}/${staff.staffTotal || "—"}`}
          icon={<UserCheck className="size-[18px]" strokeWidth={1.75} />}
        />
        <MetricCard
          label="Resolved"
          value={loading ? "—" : resolved}
          icon={<CheckCircle2 className="size-[18px]" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <section className={cn(APP_CARD, "overflow-hidden lg:col-span-2")}>
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
              <AnalyticsIcon className="size-4 text-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Conversation pipeline</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Live distribution across conversation statuses
              </p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {loading ? (
              <div className="flex justify-center py-14">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : total === 0 ? (
              <div className={cn(APP_INNER_TILE, "px-4 py-10 text-center")}>
                <p className="text-sm font-medium text-foreground">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Volume and status breakdown will appear once tickets start coming in.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    {pipeline.map((row) => (
                      <div
                        key={row.status}
                        className={cn("h-full first:rounded-l-full last:rounded-r-full", PIPELINE_BAR[row.status])}
                        style={{ width: `${(row.count / total) * 100}%` }}
                        title={`${row.label}: ${row.count}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{total} total</span>
                    <span>{active} active</span>
                    <span>{resolved} resolved</span>
                  </div>
                </div>

                <ul className="grid gap-2 sm:grid-cols-2">
                  {pipeline.map((row) => (
                    <li
                      key={row.status}
                      className={cn(APP_INNER_TILE, "flex items-center justify-between gap-3 px-3 py-2.5")}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn("size-2.5 shrink-0 rounded-full", PIPELINE_BAR[row.status])} />
                        <span className="truncate text-sm text-foreground">{row.label}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <section className={cn(APP_CARD, "overflow-hidden")}>
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
              <UsersRound className="size-4 text-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Team & coverage</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Availability and working hours</p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className={cn(APP_INNER_TILE, "space-y-3 p-4")}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Agents available</span>
                </div>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {loading ? "—" : staff.online}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: staff.staffTotal
                      ? `${Math.max(4, (staff.online / staff.staffTotal) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Loading team status…"
                  : `${staff.online} of ${staff.staffTotal} staff marked available`}
              </p>
            </div>

            <div className={cn(APP_INNER_TILE, "p-4")}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Business hours
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {loading ? "Loading…" : hoursSummary}
              </p>
            </div>

            <Link
              href="/agents"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Manage team
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <BreakdownPanel
          title="By channel"
          description="Conversations grouped by source channel"
          icon={Inbox}
          items={stats?.bySource ?? []}
          emptyLabel="No channel data yet."
          loading={loading}
        />

        <BreakdownPanel
          title="By team"
          description="Conversations routed to each team"
          icon={Users}
          items={stats?.byTeam ?? []}
          emptyLabel="No team-assigned conversations yet."
          loading={loading}
        />
      </div>
    </div>
  );
}
