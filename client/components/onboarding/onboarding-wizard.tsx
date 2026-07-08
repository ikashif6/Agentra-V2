"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { AuthLogo } from "@/components/auth/auth-logo";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  AI_OPTIONS,
  CHANNEL_OPTIONS,
  GOAL_OPTIONS,
  ONBOARDING_STEPS,
  PLATFORM_OPTIONS,
  STEP_COPY,
  VOLUME_OPTIONS,
  type OnboardingSetupPayload,
  type OnboardingStepId,
} from "./onboarding-config";
import { ChannelBrandIcon, type ChannelBrandId } from "./channel-brand-icons";
import { PlatformBrandIcon, type PlatformBrandId } from "./platform-brand-icons";

export function OnboardingWizard() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<OnboardingSetupPayload>({
    channels: [],
  });

  const step = ONBOARDING_STEPS[stepIndex];
  const copy = STEP_COPY[step];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const progress = ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const canContinue = () => {
    switch (step) {
      case "goal":
        return Boolean(answers.teamGoal);
      case "channels":
        return (answers.channels?.length ?? 0) > 0;
      case "volume":
        return Boolean(answers.ticketVolume);
      case "platform":
        return Boolean(answers.ecommercePlatform);
      case "ai":
        return Boolean(answers.aiInterest);
      default:
        return false;
    }
  };

  const goNext = async () => {
    if (!canContinue()) return;
    setFormError(null);

    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSubmitting(true);
    try {
      await onboardingApi.completeSetup(answers);
      await refreshUser();
      router.replace("/dashboard");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not save setup. Please try again.");
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-shell relative min-h-svh overflow-hidden">
      <div className="onboarding-shell-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <AuthLogo href="/dashboard" />
      </div>

      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center px-4 py-24 sm:px-6">
        <div className="mb-8 max-w-lg text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {copy.heroTitle}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.heroSubtitle}</p>
        </div>

        <div
          className={cn(
            "w-full max-w-[480px] border border-border/80 bg-white p-6 shadow-lg sm:p-8",
            authRadiusClass,
          )}
        >
          <div className="mb-6 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm font-semibold text-foreground">{copy.prompt}</p>

          <div className="mt-5">{renderStep(step, answers, setAnswers)}</div>

          {formError ? (
            <div className="mt-4">
              <AuthFormAlert message={formError} />
            </div>
          ) : null}

          <Button
            type="button"
            onClick={goNext}
            disabled={!canContinue() || submitting}
            className={cn("mt-6 h-11 w-full font-semibold", authRadiusClass)}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isLast ? (
              "Continue to dashboard"
            ) : (
              "Continue"
            )}
          </Button>

          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setStepIndex((i) => i - 1);
              }}
              className="mt-4 w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Back
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function renderStep(
  step: OnboardingStepId,
  answers: OnboardingSetupPayload,
  setAnswers: React.Dispatch<React.SetStateAction<OnboardingSetupPayload>>,
) {
  switch (step) {
    case "goal":
      return (
        <div className="flex flex-col gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              selected={answers.teamGoal === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, teamGoal: opt.id }))}
              icon={<opt.icon className="size-4" />}
              label={opt.label}
              description={opt.description}
            />
          ))}
        </div>
      );

    case "channels":
      return (
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((opt) => {
            const selected = answers.channels?.includes(opt.id) ?? false;
            return (
              <ChoicePill
                key={opt.id}
                selected={selected}
                onClick={() =>
                  setAnswers((a) => {
                    const current = a.channels ?? [];
                    const next = selected
                      ? current.filter((c) => c !== opt.id)
                      : [...current, opt.id];
                    return { ...a, channels: next };
                  })
                }
                label={opt.label}
                icon={
                  <ChannelBrandIcon
                    channel={opt.id as ChannelBrandId}
                    monochrome={selected}
                  />
                }
                showIconWhenSelected
              />
            );
          })}
        </div>
      );

    case "volume":
      return (
        <div className="flex flex-wrap gap-2">
          {VOLUME_OPTIONS.map((opt) => (
            <ChoicePill
              key={opt.id}
              selected={answers.ticketVolume === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, ticketVolume: opt.id }))}
              label={opt.label}
            />
          ))}
        </div>
      );

    case "platform":
      return (
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((opt) => {
            const selected = answers.ecommercePlatform === opt.id;
            return (
              <ChoicePill
                key={opt.id}
                selected={selected}
                onClick={() => setAnswers((a) => ({ ...a, ecommercePlatform: opt.id }))}
                label={opt.label}
                icon={
                  <PlatformBrandIcon
                    platform={opt.id as PlatformBrandId}
                    monochrome={selected}
                  />
                }
                showIconWhenSelected
              />
            );
          })}
        </div>
      );

    case "ai":
      return (
        <div className="flex flex-col gap-2">
          {AI_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              selected={answers.aiInterest === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, aiInterest: opt.id }))}
              label={opt.label}
              description={opt.description}
            />
          ))}
        </div>
      );

    default:
      return null;
  }
}

function ChoicePill({
  selected,
  onClick,
  label,
  icon,
  showIconWhenSelected = false,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  showIconWhenSelected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium leading-none transition-colors",
        selected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-foreground hover:bg-muted/80",
      )}
    >
      {icon && (showIconWhenSelected || !selected) ? icon : null}
      {selected ? (
        <Check className="size-3.5 shrink-0 self-center" strokeWidth={2.5} />
      ) : !icon ? (
        <Plus className="size-3.5 shrink-0 self-center text-muted-foreground" strokeWidth={2} />
      ) : null}
      {label}
    </button>
  );
}

function ChoiceRow({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-primary bg-accent/60"
          : "border-border bg-background hover:border-primary/30 hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center self-center rounded-full border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-transparent",
        )}
      >
        <Check className="block size-3 shrink-0" strokeWidth={3} />
      </span>
      {icon ? (
        <span className="flex size-8 shrink-0 items-center justify-center self-center rounded-lg bg-muted text-muted-foreground [&_svg]:block">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
