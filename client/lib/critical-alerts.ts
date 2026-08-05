import type { Company, Role, User } from "@/lib/types";
import { formatBillingDate } from "@/lib/billing";

export type CriticalAlert = {
  id: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const DISMISS_PREFIX = "agentra.critical-alert.dismissed.";

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

function graceDeadline(plan: Company["plan"]) {
  const base = plan.currentPeriodEnd || plan.trialEndsAt;
  if (!base) return null;
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) return null;
  // 30-day grace after access ends before data deletion warning date.
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

export function isCriticalAlertDismissed(id: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(`${DISMISS_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

export function dismissCriticalAlert(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${DISMISS_PREFIX}${id}`, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Highest-priority workspace alerts (billing / access). Role-aware.
 * Owners get billing CTAs; admins see alerts but are pointed to the owner.
 */
export function getCriticalAlerts(
  user: Pick<User, "role"> | null | undefined,
  company: Company | null | undefined,
): CriticalAlert[] {
  if (!user || !company?.plan) return [];

  const role = user.role as Role;
  const canManageBilling = role === "owner";
  const canSeeBillingAlert = role === "owner" || role === "admin";
  if (!canSeeBillingAlert) return [];

  const plan = company.plan;
  const status = plan.status || "trialing";
  const accessEnds = plan.currentPeriodEnd || plan.trialEndsAt || null;
  const accessLabel = formatBillingDate(accessEnds);
  const deletionLabel = formatBillingDate(graceDeadline(plan));
  const alerts: CriticalAlert[] = [];

  const billingCta = canManageBilling
    ? { ctaLabel: "Go to billing", ctaHref: "/settings?item=billing" }
    : { ctaLabel: "Contact workspace owner" };
  const subscribeCta = canManageBilling
    ? { ctaLabel: "Subscribe", ctaHref: "/settings?item=billing" }
    : { ctaLabel: "Contact workspace owner" };
  const updatePaymentCta = canManageBilling
    ? { ctaLabel: "Update payment", ctaHref: "/settings?item=billing" }
    : { ctaLabel: "Contact workspace owner" };

  if (status === "canceled" || status === "unpaid") {
    alerts.push({
      id: `billing-${status}`,
      message: deletionLabel
        ? `Your Agentra subscription has expired. You can re-subscribe until ${deletionLabel}. After that date your account and all its data will be deleted.`
        : "Your Agentra subscription has expired. Re-subscribe to keep access to this workspace.",
      ...subscribeCta,
    });
  } else if (status === "past_due") {
    alerts.push({
      id: "billing-past-due",
      message: accessLabel
        ? `Your Agentra payment is past due. Update billing before ${accessLabel} to avoid losing access.`
        : "Your Agentra payment is past due. Update billing to avoid losing access.",
      ...updatePaymentCta,
    });
  } else if (plan.cancelAtPeriodEnd && accessLabel) {
    alerts.push({
      id: "billing-canceling",
      message: `Your Agentra plan is set to cancel on ${accessLabel}. You keep full access until then.`,
      ...(canManageBilling
        ? { ctaLabel: "Manage billing", ctaHref: "/settings?item=billing" }
        : { ctaLabel: "Contact workspace owner" }),
    });
  } else if (status === "trialing") {
    const days = daysUntil(plan.trialEndsAt);
    if (days != null && days >= 0 && days <= 3) {
      alerts.push({
        id: "billing-trial-ending",
        message:
          days === 0
            ? "Your Agentra trial ends today. Subscribe to keep this workspace active."
            : `Your Agentra trial ends in ${days} day${days === 1 ? "" : "s"}. Subscribe to keep this workspace active.`,
        ...subscribeCta,
      });
    }
  }

  return alerts;
}
