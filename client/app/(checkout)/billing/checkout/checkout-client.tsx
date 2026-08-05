"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { billingApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import {
  AGENTRA_PRO_PLAN,
  formatMoney,
  type BillingCycle,
  type PaddleCheckoutPayload,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

const FRAME_CLASS = "paddle-checkout-frame";

async function waitForFrame(className: string, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    const el = document.querySelector(`.${className}`);
    if (el) return el;
    await new Promise((r) => window.setTimeout(r, 50));
  }
  throw new Error("Checkout frame is not ready. Please refresh and try again.");
}

export default function BillingCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycle = (searchParams.get("cycle") === "yearly" ? "yearly" : "monthly") as BillingCycle;

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const paddleRef = useRef<Paddle | null>(null);

  const price = useMemo(() => {
    if (cycle === "yearly") {
      return {
        dueLabel: formatMoney(AGENTRA_PRO_PLAN.priceYearly),
        headline: AGENTRA_PRO_PLAN.yearlyPerMonthLabel,
        period: "per month",
        lineName: AGENTRA_PRO_PLAN.label,
        lineAmount: formatMoney(AGENTRA_PRO_PLAN.priceYearly),
        billNote: "Billed yearly",
        unitNote: `${formatMoney(AGENTRA_PRO_PLAN.priceYearly)} per year`,
      };
    }
    return {
      dueLabel: formatMoney(AGENTRA_PRO_PLAN.priceMonthly),
      headline: AGENTRA_PRO_PLAN.priceLabel,
      period: "per month",
      lineName: AGENTRA_PRO_PLAN.label,
      lineAmount: formatMoney(AGENTRA_PRO_PLAN.priceMonthly),
      billNote: "Billed monthly",
      unitNote: `${formatMoney(AGENTRA_PRO_PLAN.priceMonthly)} per subscription`,
    };
  }, [cycle]);

  const successUrl = useMemo(() => {
    if (typeof window === "undefined") return "/settings?item=billing&paddle=success";
    return `${window.location.origin}/settings?item=billing&paddle=success`;
  }, []);

  const openInlineCheckout = async (instance: Paddle, payload: PaddleCheckoutPayload) => {
    await waitForFrame(FRAME_CLASS);
    await new Promise((r) => window.requestAnimationFrame(() => r(null)));

    const settings = {
      displayMode: "inline" as const,
      frameTarget: FRAME_CLASS,
      frameInitialHeight: 520,
      frameStyle: "width:100%; min-width:312px; background-color:transparent; border:none;",
      theme: "light" as const,
      successUrl,
      variant: "one-page" as const,
    };

    if (payload.transactionId) {
      instance.Checkout.open({ transactionId: payload.transactionId, settings });
      return;
    }

    instance.Checkout.open({
      items: [{ priceId: payload.priceId, quantity: 1 }],
      customData: payload.customData,
      customer: payload.customer?.id
        ? { id: payload.customer.id }
        : payload.customerAuthEmail
          ? { email: payload.customerAuthEmail }
          : undefined,
      settings,
    });
  };

  const startCheckout = async (isCancelled?: () => boolean) => {
    setBooting(true);
    setError(null);
    try {
      const { data } = await billingApi.checkout(cycle);
      if (isCancelled?.()) return;
      const payload = data.data.checkout as PaddleCheckoutPayload;

      let instance = paddleRef.current;
      if (!instance) {
        instance = await initializePaddle({
          token: payload.clientToken,
          environment: payload.env === "live" ? "production" : "sandbox",
          checkout: {
            settings: {
              displayMode: "inline",
              frameTarget: FRAME_CLASS,
              frameInitialHeight: 520,
              frameStyle:
                "width:100%; min-width:312px; background-color:transparent; border:none;",
              theme: "light",
              successUrl,
              variant: "one-page",
            },
          },
          eventCallback: (event) => {
            if (event.name === "checkout.loaded") {
              setBooting(false);
            }
            if (event.name === "checkout.completed") {
              toast.success("Payment received — activating your plan…");
              window.setTimeout(() => {
                router.replace("/settings?item=billing&paddle=success");
              }, 600);
              return;
            }
            if (event.name === "checkout.error") {
              const detail =
                (event as { data?: { error?: { detail?: string; message?: string } } }).data
                  ?.error?.detail ||
                (event as { data?: { error?: { detail?: string; message?: string } } }).data
                  ?.error?.message ||
                "Checkout failed. Please try again.";
              console.error("[paddle checkout.error]", event);
              setError(detail);
              toast.error(detail);
              setBooting(false);
            }
          },
        });
      }

      if (isCancelled?.()) return;
      if (!instance) throw new Error("Could not load Paddle Checkout");
      paddleRef.current = instance;

      setBooting(false);
      await new Promise((r) => window.setTimeout(r, 80));
      if (isCancelled?.()) return;
      await openInlineCheckout(instance, payload);
    } catch (err: unknown) {
      if (isCancelled?.()) return;
      const { message } = getApiError(err, "Could not start checkout");
      setError(message);
      toast.error(message);
      setBooting(false);
    }
  };

  useEffect(() => {
    const t = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void startCheckout(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/cycle bootstrap
  }, [cycle]);

  return (
    <div
      className={cn(
        "min-h-screen lg:grid lg:grid-cols-2",
        "transition-opacity duration-500",
        entered ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Full-bleed black half — stays fixed while payment scrolls */}
      <aside className="flex min-h-[50vh] flex-col bg-black text-white lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:self-start lg:overflow-y-auto">
        <div className="ml-auto flex w-full max-w-[520px] flex-1 flex-col py-8 pl-10 pr-8 sm:pl-12 sm:pr-10 lg:py-12 lg:pl-4 lg:pr-16 xl:pr-20">
          <div className="flex items-center gap-3">
            <Link
              href="/settings?item=billing"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Back to billing"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Link href="/settings?item=billing" className="inline-flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/agentraa-logo-white.png"
                alt="Agentra"
                width={140}
                height={32}
                className="h-7 w-auto"
              />
            </Link>
          </div>

          <div
            className={cn(
              "mt-14 transition-all delay-75 duration-500 ease-out sm:mt-20",
              entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            )}
          >
            <p className="text-[15px] font-medium text-white/55">
              Subscribe to {AGENTRA_PRO_PLAN.label}
            </p>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[3.5rem]">
                {price.headline}
              </span>
              <span className="pb-1 text-[15px] text-white/45">{price.period}</span>
            </div>

            <div className="mt-6 inline-flex rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => router.replace(`/billing/checkout?cycle=monthly`)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  cycle === "monthly"
                    ? "bg-white text-black"
                    : "text-white/45 hover:text-white/80",
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => router.replace(`/billing/checkout?cycle=yearly`)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  cycle === "yearly"
                    ? "bg-white text-black"
                    : "text-white/45 hover:text-white/80",
                )}
              >
                Yearly · save 10%
              </button>
            </div>

            <div className="mt-10 space-y-0 text-[15px]">
              <div className="flex items-start justify-between gap-8 pb-5">
                <div className="min-w-0">
                  <p className="font-medium tracking-tight text-white">{price.lineName}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/40">
                    {price.billNote}
                    <span className="text-white/25"> · </span>
                    {price.unitNote}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums text-white">{price.lineAmount}</p>
              </div>

              <div
                className="space-y-3.5 border-t pt-5"
                style={{ borderTopColor: "#1a1a1a" }}
              >
                <div className="flex items-center justify-between gap-4 text-white/55">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-white/80">{price.dueLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white/55">
                  <span>Tax</span>
                  <span className="text-[13px] text-white/35">Calculated at checkout</span>
                </div>
              </div>

              <div
                className="mt-5 flex items-center justify-between gap-4 border-t pt-5 text-[15px] font-semibold tracking-tight text-white"
                style={{ borderTopColor: "#1a1a1a" }}
              >
                <span>Total due today</span>
                <span className="tabular-nums">{price.dueLabel}</span>
              </div>
            </div>
          </div>

          <p className="mt-auto pt-14 text-[12px] leading-relaxed text-white/30">
            Renews automatically until canceled. Payments processed by Paddle as Merchant of
            Record.
          </p>
        </div>
      </aside>

      {/* Full-bleed white half — form column constrained */}
      <section
        className={cn(
          "flex min-h-[50vh] flex-col bg-white transition-all delay-100 duration-500 ease-out lg:min-h-screen",
          entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 sm:px-10 sm:py-12 lg:max-w-[580px] lg:px-10 lg:py-14">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Payment method</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Secure checkout powered by Paddle. You&apos;ll return to billing after payment.
          </p>

          {error ? (
            <div className="mt-5 space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void startCheckout()}>
                Try again
              </Button>
            </div>
          ) : null}

          <div className="relative mt-6 min-h-[440px] w-full flex-1">
            {booting ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white/90">
                <Loader2 className="size-6 animate-spin text-[#D85A30]" />
                <p className="text-sm text-neutral-500">Loading secure payment…</p>
              </div>
            ) : null}
            <div className={cn(FRAME_CLASS, "min-h-[420px] w-full")} />
          </div>
        </div>
      </section>
    </div>
  );
}
