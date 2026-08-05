"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { initializePaddle } from "@paddle/paddle-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { billingApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  AGENTRA_PRO_PLAN,
  formatMoney,
  type BillingCycle,
  type PaddleCheckoutPayload,
} from "@/lib/billing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FRAME_ID = "agentra-paddle-checkout";

export default function BillingCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycle = (searchParams.get("cycle") === "yearly" ? "yearly" : "monthly") as BillingCycle;
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const priceLabel = useMemo(() => {
    if (cycle === "yearly") {
      return {
        headline: AGENTRA_PRO_PLAN.yearlyPerMonthLabel,
        suffix: "/ month",
        detail: `Billed annually at ${formatMoney(AGENTRA_PRO_PLAN.priceYearly)}/year`,
      };
    }
    return {
      headline: AGENTRA_PRO_PLAN.priceLabel,
      suffix: "/ month",
      detail: "Billed monthly",
    };
  }, [cycle]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await billingApi.checkout(cycle);
        const checkout = data.data.checkout as PaddleCheckoutPayload;
        if (cancelled) return;

        const successUrl = `${window.location.origin}/settings?item=billing&paddle=success`;
        const paddle = await initializePaddle({
          token: checkout.clientToken,
          environment: checkout.env === "live" ? "production" : "sandbox",
          eventCallback: (event) => {
            if (event.name === "checkout.completed") {
              toast.success("Payment received — activating your plan…");
              window.setTimeout(() => {
                router.replace("/settings?item=billing&paddle=success");
              }, 800);
              return;
            }
            if (event.name === "checkout.error") {
              const detail =
                (event as { data?: { error?: { detail?: string; message?: string } } }).data?.error
                  ?.detail ||
                (event as { data?: { error?: { detail?: string; message?: string } } }).data?.error
                  ?.message ||
                "Checkout failed. Please try again.";
              setError(detail);
              toast.error(detail);
              console.error("[paddle checkout.error]", event);
            }
          },
        });

        if (!paddle) {
          throw new Error("Could not load Paddle Checkout");
        }

        paddle.Checkout.open({
          items: [{ priceId: checkout.priceId, quantity: 1 }],
          customData: checkout.customData,
          customer: checkout.customer?.id
            ? { id: checkout.customer.id }
            : checkout.customerAuthEmail
              ? { email: checkout.customerAuthEmail }
              : undefined,
          settings: {
            displayMode: "inline",
            frameTarget: FRAME_ID,
            frameInitialHeight: 520,
            frameStyle:
              "width:100%; min-width:312px; background-color:transparent; border:none;",
            successUrl,
            allowLogout: true,
            showAddTaxId: true,
          },
        });
      } catch (err: unknown) {
        const { message } = getApiError(err, "Could not start checkout");
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cycle, router]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-0 md:py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/settings?item=billing"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 mb-2 h-8 px-2 text-muted-foreground",
            )}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to billing
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Subscribe to {AGENTRA_PRO_PLAN.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure checkout powered by Paddle. You&apos;ll return here after payment.
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-right">
          <p className="text-xs text-muted-foreground">Due today</p>
          <p className="text-lg font-semibold text-foreground">
            {priceLabel.headline}
            <span className="text-sm font-normal text-muted-foreground">{priceLabel.suffix}</span>
          </p>
          <p className="text-xs text-muted-foreground">{priceLabel.detail}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}{" "}
          <Link href="/settings?item=billing" className="font-medium underline underline-offset-2">
            Return to billing
          </Link>
        </div>
      ) : null}

      <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-border/70 bg-card">
        {booting ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading secure checkout…</p>
          </div>
        ) : null}
        <div id={FRAME_ID} className="min-h-[520px] w-full p-2 sm:p-4" />
      </div>
    </div>
  );
}
