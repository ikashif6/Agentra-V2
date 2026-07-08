"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await billingApi.getOverview();
      setBilling(data.data.billing);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load billing");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Plan & billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace runs on Agentra Pro, one plan with everything included.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">{AGENTRA_PRO_PLAN.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {AGENTRA_PRO_PLAN.priceLabel}
              <span className="text-base font-normal text-muted-foreground"> / month</span>
            </p>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {status}
          </span>
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

        {billing.plan.trialEndsAt && !isCancelScheduled ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Trial ends{" "}
            {new Date(billing.plan.trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })}.
            Add a payment method to continue on Pro after that date.
          </p>
        ) : isCancelScheduled && accessEndsLabel ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Your plan cancels on {accessEndsLabel}. You keep full access until then.
          </p>
        ) : billing.plan.currentPeriodEnd && !isCancelScheduled ? (
          <p className="border-t border-border/60 px-5 py-3 text-sm text-muted-foreground">
            Renews{" "}
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
                  <p className="text-xs text-muted-foreground">
                    Expires {billing.paymentMethod.expMonth}/{billing.paymentMethod.expYear}
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@agentraa.com?subject=Update%20payment%20method"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Update
              </a>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">No card on file.</p>
              <a
                href="mailto:support@agentraa.com?subject=Add%20payment%20method"
                className={buttonVariants({ size: "sm" })}
              >
                Add payment method
              </a>
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
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
                        >
                          <Download className="mr-1 size-3.5" />
                          PDF
                        </a>
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

      {!isCanceled ? (
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
              <Button size="sm" onClick={handleReactivatePlan} disabled={reactivating}>
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
              onClick={handleCancelPlan}
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
