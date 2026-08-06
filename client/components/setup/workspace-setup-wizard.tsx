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
import {
  resolveSetupStepId,
  resolveSetupTaskId,
  setupStepHref,
  WORKSPACE_SETUP_FLOW,
  type SetupPanelId,
  type WorkspaceSetupStepId,
} from "@/lib/workspace-setup";
import { SITE_LEGAL } from "@/lib/site";
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
  const activeTask = step.tasks.find((task) => task.id === taskId) ?? step.tasks[0];
  const showTaskTabs = step.tasks.length > 1;
  const returnTo = setupStepHref(stepId, showTaskTabs ? activeTask.id : undefined);
  const taskIndex = Math.max(
    0,
    step.tasks.findIndex((task) => task.id === activeTask.id),
  );
  const nextTask =
    taskIndex >= 0 && taskIndex < step.tasks.length - 1 ? step.tasks[taskIndex + 1] : null;
  const nextStep = !isLast ? WORKSPACE_SETUP_FLOW[stepIndex + 1] : null;

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

  const goNextStep = () => {
    if (isLast) {
      router.push("/dashboard");
      return;
    }
    goTo(WORKSPACE_SETUP_FLOW[stepIndex + 1].id);
  };

  /** Advance to the next tab in this step, or the next major step when on the last tab. */
  const goNextTask = () => {
    if (nextTask) {
      goTo(stepId, nextTask.id);
      return;
    }
    goNextStep();
  };

  /** Skip the current tab (or major step when this is the last tab). */
  const skipForNow = () => {
    goNextTask();
  };

  const goBack = () => {
    if (taskIndex > 0) {
      goTo(stepId, step.tasks[taskIndex - 1].id);
      return;
    }
    if (stepIndex === 0) {
      router.push("/dashboard");
      return;
    }
    const prev = WORKSPACE_SETUP_FLOW[stepIndex - 1];
    const prevTask = prev.tasks[prev.tasks.length - 1];
    goTo(prev.id, prev.tasks.length > 1 ? prevTask.id : undefined);
  };

  const primaryLabel = nextTask
    ? `Next: ${nextTask.title}`
    : nextStep
      ? `Next: ${nextStep.label}`
      : "Finish";

  const skipLabel = nextTask || nextStep ? "Skip for now" : "Skip and finish";

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-background">
      <header className="relative z-20 flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <AuthLogo href="/dashboard" />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Exit to home
          </button>
          <a
            href={SITE_LEGAL.getHelp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Get help
          </a>
        </div>
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
            "border border-border/80 bg-card shadow-lg dark:border-white/[0.06] dark:shadow-[0_16px_48px_-20px_rgba(0,0,0,0.65)]",
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
              {stepIndex === 0 && taskIndex === 0 ? "Back to home" : "Previous"}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={skipForNow}
                className={cn("h-10 font-semibold", authRadiusClass)}
              >
                {skipLabel}
              </Button>
              <Button
                type="button"
                onClick={goNextTask}
                className={cn("h-10 gap-1 px-4 font-semibold", authRadiusClass)}
              >
                {primaryLabel}
                {nextTask || nextStep ? <ArrowRight className="size-3.5" /> : null}
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
    case "customize":
      return <CustomizeWorkspacePanel showDangerZone={false} onUpdated={() => void onRefreshStatus?.()} />;
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
