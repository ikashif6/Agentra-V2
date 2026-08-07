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
import { getSubdomain, mirrorAuthCookiesToParentDomain } from "@/lib/auth";
import {
  AGENTRA_PRO_PLAN,
  formatMoney,
  type BillingCycle,
  type PaddleCheckoutPayload,
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import {
  buildPortalCheckoutUrl,
  buildWorkspaceOrigin,
  shouldRedirectCheckoutToPortal,
} from "@/lib/workspace-host";

const FRAME_CLASS = "paddle-checkout-frame";
const LOAD_TIMEOUT_MS = 20000;

async function waitForFrame(className: string, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    const el = document.querySelector(`.${className}`);
    if (el) return el;
    await new Promise((r) => window.setTimeout(r, 50));
  }
  throw new Error("Checkout frame is not ready. Please refresh and try again.");
}

function domainApprovalHint() {
  const host = typeof window !== "undefined" ? window.location.hostname : "this domain";
  return `Checkout did not load on ${host}. In Paddle → Checkout → Website approval, add and approve this exact domain (subdomains are approved separately), then try again.`;
}

export default function BillingCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycle = (searchParams.get("cycle") === "yearly" ? "yearly" : "monthly") as BillingCycle;
  const returnSubdomain = searchParams.get("return") || getSubdomain() || null;

  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const paddleRef = useRef<Paddle | null>(null);
  const runIdRef = useRef(0);
  const loadedRef = useRef(false);

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
    if (returnSubdomain) {
      return `${buildWorkspaceOrigin(returnSubdomain)}/settings?item=billing&paddle=success`;
    }
    return `${window.location.origin}/settings?item=billing&paddle=success`;
  }, [returnSubdomain]);

  const billingHomeHref = returnSubdomain
    ? `${buildWorkspaceOrigin(returnSubdomain)}/settings?item=billing`
    : "/settings?item=billing";

  const checkoutSettings = useMemo(
    () => ({
      displayMode: "inline" as const,
      frameTarget: FRAME_CLASS,
      frameInitialHeight: 520,
      frameStyle: "width:100%; min-width:312px; background-color:transparent; border:none;",
      theme: "light" as const,
      successUrl,
      variant: "one-page" as const,
    }),
    [successUrl],
  );

  const openInlineCheckout = async (instance: Paddle, payload: PaddleCheckoutPayload) => {
    await waitForFrame(FRAME_CLASS);
    // Clear previous iframe nodes so reopen / cycle switch doesn't stall
    const frame = document.querySelector(`.${FRAME_CLASS}`);
    if (frame) frame.innerHTML = "";

    await new Promise((r) => window.requestAnimationFrame(() => r(null)));

    if (payload.transactionId) {
      instance.Checkout.open({ transactionId: payload.transactionId, settings: checkoutSettings });
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
      settings: checkoutSettings,
    });
  };

  const startCheckout = async () => {
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;

    loadedRef.current = false;
    setBooting(true);
    setError(null);

    let timeoutId: number | undefined;
    try {
      const { data } = await billingApi.checkout(cycle);
      if (isStale()) return;
      const payload = data.data.checkout as PaddleCheckoutPayload;

      await waitForFrame(FRAME_CLASS);
      if (isStale()) return;

      let instance: Paddle | null = paddleRef.current;
      if (!instance) {
        instance =
          (await initializePaddle({
            token: payload.clientToken,
            environment: payload.env === "live" ? "production" : "sandbox",
            eventCallback: (event) => {
              if (isStale()) return;
              if (event.name === "checkout.loaded") {
                loadedRef.current = true;
                if (timeoutId) window.clearTimeout(timeoutId);
                setBooting(false);
                setError(null);
              }
              if (event.name === "checkout.completed") {
                toast.success("Payment received. Activating your plan…");
                window.setTimeout(() => {
                  router.replace("/settings?item=billing&paddle=success");
                }, 600);
                return;
              }
              if (event.name === "checkout.error") {
                const e = event as {
                  detail?: string;
                  code?: string;
                  type?: string;
                  data?: {
                    detail?: string;
                    error?: { detail?: string; message?: string; code?: string };
                  };
                };
                const detail =
                  e.detail ||
                  e.data?.detail ||
                  e.data?.error?.detail ||
                  e.data?.error?.message ||
                  "Checkout failed. Please try again.";
                const code = e.code || e.data?.error?.code || "";
                console.error("[paddle checkout.error]", event);
                if (timeoutId) window.clearTimeout(timeoutId);

                const lower = `${detail} ${code}`.toLowerCase();
                const message =
                  lower.includes("domain") || lower.includes("not approved")
                    ? domainApprovalHint()
                    : detail;

                setError(message);
                toast.error(message);
                setBooting(false);
              }
            },
          })) ?? null;
      }

      if (isStale()) return;
      if (!instance) throw new Error("Could not load Paddle Checkout");
      paddleRef.current = instance;

      timeoutId = window.setTimeout(() => {
        if (isStale() || loadedRef.current) return;
        const message = domainApprovalHint();
        setError(message);
        toast.error("Checkout is taking too long to load");
        setBooting(false);
      }, LOAD_TIMEOUT_MS);

      await openInlineCheckout(instance, payload);
    } catch (err: unknown) {
      if (isStale()) return;
      if (timeoutId) window.clearTimeout(timeoutId);
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

  // Never run live Paddle on tenant subdomains — only app.agentraa.com is approved.
  useEffect(() => {
    if (!shouldRedirectCheckoutToPortal()) return;
    mirrorAuthCookiesToParentDomain();
    window.location.replace(buildPortalCheckoutUrl(cycle, returnSubdomain || getSubdomain()));
  }, [cycle, returnSubdomain]);

  useEffect(() => {
    if (shouldRedirectCheckoutToPortal()) return;
    void startCheckout();
    return () => {
      runIdRef.current += 1;
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
      <aside className="flex min-h-[50vh] flex-col bg-black text-white lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:self-start lg:overflow-y-auto">
        <div className="ml-auto flex w-full max-w-[520px] flex-1 flex-col py-8 pl-10 pr-8 sm:pl-12 sm:pr-10 lg:py-12 lg:pl-4 lg:pr-16 xl:pr-20">
          <div className="flex items-center gap-3">
            <Link
              href={billingHomeHref}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Back to billing"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <Link href={billingHomeHref} className="inline-flex items-center">
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
                onClick={() => {
                  const qs = new URLSearchParams({ cycle: "monthly" });
                  if (returnSubdomain) qs.set("return", returnSubdomain);
                  router.replace(`/billing/checkout?${qs.toString()}`);
                }}
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
                onClick={() => {
                  const qs = new URLSearchParams({ cycle: "yearly" });
                  if (returnSubdomain) qs.set("return", returnSubdomain);
                  router.replace(`/billing/checkout?${qs.toString()}`);
                }}
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
