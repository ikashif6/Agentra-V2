"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeSetupDefer } from "@/hooks/use-home-setup-defer";
import { useUserLocalTime } from "@/hooks/use-user-local-time";
import { ticketApi } from "@/lib/api";
import { Ticket as TicketType } from "@/lib/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { AppCard, AppCardBody, AppCardHeader } from "@/components/app/app-card";
import { AppEmptyState, AppListDivider, AppListRowLink } from "@/components/app/app-list-row";
import { HomeSetupPanel } from "@/components/home/home-setup-panel";
import { HomeSetupPrompt } from "@/components/home/home-setup-prompt";
import { HomeResourceCards } from "@/components/home/home-resource-cards";

const MONO_BADGE = "border border-neutral-200 bg-neutral-100 text-neutral-700";
const DASHBOARD_CARD = "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

export default function HomePage() {
  const { user } = useAuth();
  const { greeting } = useUserLocalTime();
  const { deferred, setDeferred, ready } = useHomeSetupDefer();
  const [recent, setRecent] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const onboardingComplete = Boolean(user?.onboardingCompleted);
  const showPrompt = ready && !onboardingComplete && !deferred;
  const showSetupPanel = ready && !onboardingComplete && deferred;

  const loadRecent = async () => {
    try {
      const ticketsRes = await ticketApi.list({ limit: 5, scope: "dashboard" });
      setRecent(ticketsRes.data.data.tickets);
    } catch {
      /* ignore */
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
      await loadRecent();
    } catch {
      toast.error("Could not load demo data");
    } finally {
      setLoadingDemo(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await loadRecent();
      setLoading(false);
    };
    void loadAll();
  }, []);

  return (
    <div className="dashboard-monochrome mx-auto max-w-6xl space-y-8 text-neutral-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {greeting}, {user?.firstName}
        </h1>
        <p className="text-sm text-neutral-500">
          {onboardingComplete
            ? "Your workspace overview and quick actions."
            : deferred
              ? "Your workspace overview and quick actions."
              : "Finish setup to start managing customer conversations."}
        </p>
      </div>

      {showPrompt ? <HomeSetupPrompt monochrome onDefer={setDeferred} /> : null}

      {showSetupPanel ? <HomeSetupPanel monochrome /> : null}

      <HomeResourceCards monochrome />

      <AppCard className={DASHBOARD_CARD}>
        <AppCardHeader
          title="Recent conversations"
          action={
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-900 hover:underline"
            >
              Open inbox <ArrowRight className="size-3" />
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

      {!onboardingComplete && !deferred ? (
        <p className="text-center text-sm text-neutral-500">
          Prefer the full setup wizard?{" "}
          <Link href="/onboarding" className="font-medium text-neutral-900 hover:underline">
            Continue guided setup
          </Link>
        </p>
      ) : null}
    </div>
  );
}
