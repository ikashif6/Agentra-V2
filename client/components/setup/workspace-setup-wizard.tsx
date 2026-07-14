"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AuthLogo } from "@/components/auth/auth-logo";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";
import StoreSettingsPanel from "@/components/settings/store-settings-panel";
import AiAgentSettingsPanel from "@/components/settings/ai-agent-settings-panel";
import HelpdeskAiSettingsPanel from "@/components/settings/helpdesk-ai-settings-panel";
import EmailSettingsPanel from "@/components/settings/email-settings-panel";
import LiveChatSettingsPanel from "@/components/settings/live-chat-settings-panel";
import WhatsAppSettingsPanel from "@/components/settings/whatsapp-settings-panel";
import InstagramSettingsPanel from "@/components/settings/instagram-settings-panel";
import FacebookSettingsPanel from "@/components/settings/facebook-settings-panel";
import CustomizeWorkspacePanel from "@/components/settings/customize-workspace-panel";
import NewUserPanel from "@/components/settings/new-user-panel";
import NewTeamPanel from "@/components/settings/new-team-panel";
import { ChannelPlaceholderPanel } from "@/components/settings/settings-placeholders";
import {
  resolveSetupStepId,
  resolveSetupTaskId,
  setupStepHref,
  WORKSPACE_SETUP_FLOW,
  type SetupPanelId,
  type WorkspaceSetupStepId,
} from "@/lib/workspace-setup";
import { cn } from "@/lib/utils";

type WorkspaceSetupWizardProps = {
  completedIds?: WorkspaceSetupStepId[];
  onRefreshStatus?: () => void | Promise<void>;
};

export function WorkspaceSetupWizard({
  completedIds = [],
  onRefreshStatus,
}: WorkspaceSetupWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepId = resolveSetupStepId(searchParams.get("step"));
  const taskId = resolveSetupTaskId(stepId, searchParams.get("task"));
  const stepIndex = Math.max(
    0,
    WORKSPACE_SETUP_FLOW.findIndex((step) => step.id === stepId),
  );
  const step = WORKSPACE_SETUP_FLOW[stepIndex];
  const isLast = stepIndex === WORKSPACE_SETUP_FLOW.length - 1;
  const progress = ((stepIndex + 1) / WORKSPACE_SETUP_FLOW.length) * 100;
  const completed = useMemo(() => new Set(completedIds), [completedIds]);
  const stepDone = completed.has(step.id);
  const activeTask = step.tasks.find((task) => task.id === taskId) ?? step.tasks[0];
  const showTaskTabs = step.tasks.length > 1;
  const returnTo = setupStepHref(stepId, showTaskTabs ? activeTask.id : undefined);

  useEffect(() => {
    const refresh = () => {
      void onRefreshStatus?.();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [onRefreshStatus]);

  useEffect(() => {
    void onRefreshStatus?.();
  }, [stepId, onRefreshStatus]);

  const goTo = (id: WorkspaceSetupStepId, task?: string) => {
    router.replace(setupStepHref(id, task), { scroll: false });
  };

  const goNext = () => {
    if (isLast) {
      router.push("/dashboard");
      return;
    }
    goTo(WORKSPACE_SETUP_FLOW[stepIndex + 1].id);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.push("/dashboard");
      return;
    }
    goTo(WORKSPACE_SETUP_FLOW[stepIndex - 1].id);
  };

  return (
    <div className="onboarding-shell relative min-h-svh overflow-x-hidden">
      <div className="onboarding-shell-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <AuthLogo href="/dashboard" />
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Exit to home
        </button>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-16 pt-2 sm:px-6">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step {stepIndex + 1} of {WORKSPACE_SETUP_FLOW.length}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {step.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
        </div>

        <div
          className={cn(
            "border border-border/80 bg-white shadow-lg",
            authRadiusClass,
          )}
        >
          <div className="border-b border-border/60 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {WORKSPACE_SETUP_FLOW.map((entry, index) => {
                const active = index === stepIndex;
                const done = completed.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => goTo(entry.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "border border-border bg-muted/60 text-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={2.5} /> : null}
                    {entry.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/80 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {showTaskTabs ? (
            <div className="flex flex-wrap gap-1 border-b border-border/60 px-5 py-3 sm:px-6">
              {step.tasks.map((task) => {
                const active = task.id === activeTask.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => goTo(stepId, task.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {task.title}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            {showTaskTabs ? (
              <p className="mb-4 text-sm text-muted-foreground">{activeTask.description}</p>
            ) : null}
            <SetupPanelHost
              panel={activeTask.panel}
              returnTo={returnTo}
              onRefreshStatus={onRefreshStatus}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {stepIndex === 0 ? "Back to home" : "Previous step"}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              {!stepDone ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goNext}
                  className={cn("h-10 font-semibold", authRadiusClass)}
                >
                  Skip for now
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={goNext}
                className={cn("h-10 gap-1 px-4 font-semibold", authRadiusClass)}
              >
                {isLast ? "Finish" : "Continue"}
                {!isLast ? <ArrowRight className="size-3.5" /> : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupPanelHost({
  panel,
  returnTo,
  onRefreshStatus,
}: {
  panel: SetupPanelId;
  returnTo: string;
  onRefreshStatus?: () => void | Promise<void>;
}) {
  switch (panel) {
    case "store":
      return <StoreSettingsPanel returnTo={returnTo} />;
    case "ai-agent":
      return <AiAgentSettingsPanel />;
    case "helpdesk-ai":
      return <HelpdeskAiSettingsPanel />;
    case "email":
      return <EmailSettingsPanel />;
    case "chat":
      return <LiveChatSettingsPanel />;
    case "whatsapp":
      return <WhatsAppSettingsPanel />;
    case "instagram":
      return <InstagramSettingsPanel returnTo={returnTo} />;
    case "facebook":
      return <FacebookSettingsPanel returnTo={returnTo} />;
    case "tiktok":
      return (
        <ChannelPlaceholderPanel
          title="TikTok"
          description="Reply to TikTok direct messages alongside other channels"
        />
      );
    case "customize":
      return <CustomizeWorkspacePanel onUpdated={() => void onRefreshStatus?.()} />;
    case "invite-user":
      return (
        <NewUserPanel
          hideBack
          onBack={() => void onRefreshStatus?.()}
          onCreated={() => void onRefreshStatus?.()}
        />
      );
    case "create-team":
      return (
        <NewTeamPanel
          hideBack
          onBack={() => void onRefreshStatus?.()}
          onCreated={() => void onRefreshStatus?.()}
        />
      );
    default:
      return null;
  }
}
