"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Download, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { billingApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  AGENTRA_PRO_PLAN,
  formatBillingDate,
  formatMoney,
  invoiceStatusLabel,
  planStatusLabel,
  type BillingCycle,
  type BillingOverview,
} from "@/lib/billing";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function BillingPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await billingApi.getOverview();
      const next = data.data.billing as BillingOverview;
      setBilling(next);
      if (next.plan?.billingCycle === "yearly" || next.plan?.billingCycle === "monthly") {
        setCycle(next.plan.billingCycle);
      }
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load billing");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("paddle") !== "success") return;
    toast.success("Payment received. Your plan is updating");
    void load();
    const t = window.setTimeout(() => void load(), 2500);
    const url = new URL(window.location.href);
    url.searchParams.delete("paddle");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", qs ? `${url.pathname}?${qs}` : url.pathname);
    return () => window.clearTimeout(t);
  }, [load, searchParams]);

  const handleCancelPlan = async () => {
    setCanceling(true);
    try {
      const { data } = await billingApi.cancelPlan();
      setBilling(data.data.billing);
      setCancelDialogOpen(false);
      toast.success("Your plan will cancel at the end of the billing period");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not cancel plan");
      toast.error(message);
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivatePlan = async () => {
    setReactivating(true);
    try {
      const { data } = await billingApi.reactivatePlan();
      setBilling(data.data.billing);
      toast.success("Your plan will continue as normal");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not reactivate plan");
      toast.error(message);
    } finally {
      setReactivating(false);
    }
  };

  const goToCheckout = () => {
    router.push(`/billing/checkout?cycle=${cycle}`);
  };

  const openInvoicePdf = async (invoiceNumber: string) => {
    setPdfLoading(invoiceNumber);
    try {
      const { data } = await billingApi.invoicePdf(invoiceNumber);
      const url = data.data.url as string;
      if (!url) throw new Error("No PDF url returned");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not open invoice PDF");
      toast.error(message);
    } finally {
      setPdfLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await billingApi.portal();
      const url = data.data.url as string;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not open billing portal");
      toast.error(message);
    } finally {
      setPortalLoading(false);
    }
  };

  const priceHeadline = useMemo(() => {
    if (cycle === "yearly") {
      return {
        main: AGENTRA_PRO_PLAN.yearlyPerMonthLabel,
        suffix: "/ month",
        note: `Billed annually at ${AGENTRA_PRO_PLAN.yearlyTotalLabel}/year (10% off)`,
      };
    }
    return {
      main: AGENTRA_PRO_PLAN.priceLabel,
      suffix: "/ month",
      note: "Billed monthly",
    };
  }, [cycle]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!billing) return null;

  const status = planStatusLabel(billing.plan.status, billing.plan.cancelAtPeriodEnd);
  const accessEndsLabel = formatBillingDate(billing.plan.accessEndsAt);
  const isCanceled = billing.plan.status === "canceled";
  const isCancelScheduled = Boolean(billing.plan.cancelAtPeriodEnd);
  const isTrialing = billing.plan.status === "trialing";
  const needsSubscribe =
    billing.plan.status === "trialing" ||
    billing.plan.status === "canceled" ||
    billing.plan.status === "unpaid";
  const isPastDue = billing.plan.status === "past_due";
  const isSubscribed =
    billing.plan.status === "active" ||
    billing.plan.status === "past_due" ||
    (isCancelScheduled && billing.plan.status !== "canceled");
  const canManagePayment = Boolean(billing.plan.hasPaddleSubscription || billing.paymentMethod);
  const planCycleLabel =
    billing.plan.billingCycle === "yearly" ? "Yearly billing" : "Monthly billing";

  const membership = (() => {
    if (isTrialing) {
      return {
        title: "Not subscribed",
        detail: accessEndsLabel
          ? `You're on a free trial of Agentra Pro until ${accessEndsLabel}.`
          : "You're on a free trial of Agentra Pro.",
        badge: "Trial",
        badgeClass:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
    }
    if (isCanceled || billing.plan.status === "unpaid") {
      return {
        title: "Not subscribed",
        detail: "Your Agentra Pro subscription is not active. Subscribe to restore full access.",
        badge: status,
        badgeClass: "border-border bg-muted text-muted-foreground",
      };
    }
    if (isPastDue) {
      return {
        title: "Subscribed · payment issue",
        detail: "You're on Agentra Pro, but the last payment failed. Update your card to keep access.",
        badge: "Past due",
        badgeClass:
          "border-destructive/30 bg-destructive/10 text-destructive",
      };
    }
    if (isCancelScheduled) {
      return {
        title: "Subscribed · canceling",
        detail: accessEndsLabel
          ? `You're on Agentra Pro until ${accessEndsLabel}, then billing stops.`
          : "You're on Agentra Pro, and cancellation is scheduled.",
        badge: "Canceling",
        badgeClass:
          "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
    }
    return {
      title: "Subscribed",
      detail: `You're subscribed to Agentra Pro (${planCycleLabel.toLowerCase()}).`,
      badge: "Active",
      badgeClass:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    };
  })();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Plan & billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your Agentra Pro subscription. Payments are processed securely by Paddle.
          {billing.paddleEnv === "sandbox" ? " (Sandbox mode)" : null}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Current plan
                </p>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-medium",
                    membership.badgeClass,
                  )}
                >
                  {membership.badge}
                </span>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                Agentra Pro
              </h3>
              <p className="text-sm font-medium text-foreground">{membership.title}</p>
              <p className="max-w-xl text-sm text-muted-foreground">{membership.detail}</p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {isSubscribed && billing.plan.billingCycle === "yearly"
                  ? AGENTRA_PRO_PLAN.yearlyPerMonthLabel
                  : needsSubscribe
                    ? priceHeadline.main
                    : AGENTRA_PRO_PLAN.priceLabel}
                <span className="text-base font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSubscribed
                  ? planCycleLabel
                  : needsSubscribe
                    ? priceHeadline.note
                    : "Billed monthly"}
              </p>
            </div>
          </div>

          {needsSubscribe ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div
                role="radiogroup"
                aria-label="Billing cycle"
                className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={cycle === "monthly"}
                  onClick={() => setCycle("monthly")}
                  className={cn(
                    "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                    cycle === "monthly"
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={cycle === "yearly"}
                  onClick={() => setCycle("yearly")}
                  className={cn(
                    "rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                    cycle === "yearly"
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Yearly
                  <span
                    className={cn(
                      "ml-1.5 text-xs font-semibold",
                      cycle === "yearly" ? "text-primary" : "text-primary/80",
                    )}
                  >
                    save 10%
                  </span>
                </button>
              </div>

              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  type="button"
                  onClick={goToCheckout}
                  disabled={!billing.paddleConfigured}
                  className="h-9 rounded-[10px] px-4"
                >
                  {isCanceled || billing.plan.status === "unpaid"
                    ? "Resubscribe to Pro"
                    : "Subscribe to Pro"}
                </Button>
                {!billing.paddleConfigured ? (
                  <p className="text-xs text-muted-foreground">
                    Paddle is not configured on this server yet.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {cycle === "yearly"
                      ? `${AGENTRA_PRO_PLAN.yearlyTotalLabel} billed yearly`
                      : `${AGENTRA_PRO_PLAN.priceLabel} billed monthly`}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {isPastDue ? (
            <div className="mt-5 border-t border-border/60 pt-4">
              <Button
                type="button"
                onClick={() => void handlePortal()}
                disabled={portalLoading || !billing.paddleConfigured}
              >
                {portalLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Update payment method
              </Button>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">{AGENTRA_PRO_PLAN.description}</p>
          <ul className="mt-4 grid list-disc gap-2 pl-5 sm:grid-cols-2">
            {AGENTRA_PRO_PLAN.highlights.map((item) => (
              <li key={item} className="text-sm text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid border-t border-border/60 sm:grid-cols-3">
          {[
            ["Members", billing.usage.totalUsers],
            ["Agents", billing.usage.totalAgents],
            ["Tickets", billing.usage.totalTickets],
          ].map(([label, count]) => (
            <div key={label as string} className="border-border/60 px-5 py-3.5 sm:border-r last:sm:border-r-0">
              <p className="text-xs text-muted-foreground">{label as string}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {count as number}{" "}
                <span className="font-normal text-muted-foreground">(unlimited)</span>
              </p>
            </div>
          ))}
        </div>

        {billing.plan.trialEndsAt && billing.plan.status === "trialing" && !isCancelScheduled ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Trial ends{" "}
            {new Date(billing.plan.trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })}.
            Subscribe to keep Agentra Pro after that date.
          </p>
        ) : isCancelScheduled && accessEndsLabel ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Access continues until {accessEndsLabel}.
          </p>
        ) : billing.plan.currentPeriodEnd && isSubscribed && !isCancelScheduled ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Next renewal{" "}
            {new Date(billing.plan.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: "medium" })}.
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Payment method</p>
        </div>
        <div className="px-5 py-4">
          {billing.paymentMethod ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-border/70">
                  <CreditCard className="size-[18px] text-foreground" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {billing.paymentMethod.brand ?? "Card"} ending in {billing.paymentMethod.last4}
                  </p>
                  {billing.paymentMethod.expMonth && billing.paymentMethod.expYear ? (
                    <p className="text-xs text-muted-foreground">
                      Expires {billing.paymentMethod.expMonth}/{billing.paymentMethod.expYear}
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handlePortal()}
                disabled={portalLoading || !canManagePayment}
              >
                {portalLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Update
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">No card on file.</p>
              {needsSubscribe ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={goToCheckout}
                  disabled={!billing.paddleConfigured}
                >
                  Add payment method
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handlePortal()}
                  disabled={portalLoading || !billing.plan.hasPaddleSubscription}
                >
                  {portalLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Manage in Paddle
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/60 px-5 py-3">
          <p className="text-sm font-medium text-foreground">Payment history</p>
        </div>

        {billing.invoices.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Receipt className="mx-auto size-5 text-muted-foreground/50" strokeWidth={1.75} />
            <p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-muted-foreground">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {billing.invoices.map((invoice) => (
                  <tr key={invoice._id ?? invoice.number}>
                    <td className="px-5 py-3 font-medium text-foreground">{invoice.number}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {new Date(invoice.issuedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {invoiceStatusLabel(invoice.status)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {invoice.hasPdf !== false ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={pdfLoading === invoice.number}
                          onClick={() => void openInvoicePdf(invoice.number)}
                        >
                          {pdfLoading === invoice.number ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1 size-3.5" />
                          )}
                          PDF
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/50">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!isCanceled && billing.plan.status !== "trialing" ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-foreground">
                {isCancelScheduled ? "Plan canceling" : "Cancel plan"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isCancelScheduled && accessEndsLabel
                  ? `Your workspace stays active until ${accessEndsLabel}. You can keep your plan anytime before that date.`
                  : accessEndsLabel
                    ? `If you cancel, you keep full access to Pro until ${accessEndsLabel}.`
                    : "If you cancel, you keep full access to your plan features until the end of your billing period."}
              </p>
            </div>

            {isCancelScheduled ? (
              <Button size="sm" onClick={() => void handleReactivatePlan()} disabled={reactivating}>
                {reactivating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Keep plan
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </section>
      ) : null}

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel your plan?</DialogTitle>
            <DialogDescription>
              {accessEndsLabel
                ? `You will keep full access to Agentra Pro until ${accessEndsLabel}. After that, your workspace will be deactivated and billing will stop.`
                : "You will keep full access until the end of your current billing period. After that, your workspace will be deactivated."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={canceling}
            >
              Keep plan
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleCancelPlan()}
              disabled={canceling}
            >
              {canceling ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Cancel plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
