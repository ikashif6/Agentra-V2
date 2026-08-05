import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AGENTRA_PRO_PLAN } from "@/lib/billing";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: `${LEGAL.productName} — AI agent and helpdesk for ecommerce`,
  description: `${LEGAL.productName} is a multi-channel customer support workspace with inbox, AI agent, store integrations, and team collaboration. ${AGENTRA_PRO_PLAN.priceLabel}/month or ${AGENTRA_PRO_PLAN.yearlyTotalLabel}/year.`,
  alternates: {
    canonical: PORTAL_ORIGIN,
  },
};

const FEATURES = [
  "Shared team inbox across email, chat, and messaging channels",
  "AI Agent for storefront questions, order help, and escalations",
  "Ecommerce store connections (Shopify, WooCommerce, and more)",
  "Tickets, departments, analytics, and unlimited team members on Pro",
];

export default function RootPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Image
            src="/agentraa-logo.svg"
            alt={LEGAL.companyName}
            width={290}
            height={65}
            priority
            className="h-8 w-auto"
          />
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[13px] text-neutral-500">
            <a href="#pricing" className="hover:text-neutral-900">
              Pricing
            </a>
            <Link href="/terms" className="hover:text-neutral-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <Link href="/refund" className="hover:text-neutral-900">
              Refunds
            </Link>
            <Link href="/auth/login" className="font-medium text-neutral-900 hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-sm font-medium text-neutral-500">{LEGAL.companyName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          AI agent and helpdesk built around your store
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
          {LEGAL.productName} is a customer support workspace for ecommerce teams. Run a shared
          inbox, connect your store, and use AI to handle routine questions — then hand off to
          humans when needed. Billing and checkout are handled securely through Paddle.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Start free trial
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Sign in to workspace
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950">What you get</h2>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-neutral-600">
            {FEATURES.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-900" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" className="mt-14 scroll-mt-8 border-t border-neutral-200 pt-14">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950">Pricing</h2>
          <p className="mt-2 text-[15px] text-neutral-600">
            One Pro plan. 14-day free trial — no card required to start. Subscribe when you&apos;re
            ready.
          </p>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-6 sm:px-8">
            <p className="text-sm font-medium text-neutral-500">{AGENTRA_PRO_PLAN.label}</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-neutral-950">
                {AGENTRA_PRO_PLAN.priceLabel}
              </span>
              <span className="text-sm text-neutral-500">/ month</span>
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              or {AGENTRA_PRO_PLAN.yearlyTotalLabel}/year ({AGENTRA_PRO_PLAN.yearlyPerMonthLabel}/mo
              billed annually)
            </p>
            <ul className="mt-5 space-y-2 text-sm text-neutral-700">
              {AGENTRA_PRO_PLAN.highlights.map((h) => (
                <li key={h}>• {h}</li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-neutral-500">
              Subscriptions renew automatically until canceled. Payments are processed by Paddle as
              Merchant of Record. See our{" "}
              <Link href="/refund" className="underline underline-offset-2 hover:text-neutral-800">
                Refund Policy
              </Link>
              ,{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-neutral-800">
                Terms
              </Link>
              , and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-800">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-[13px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {LEGAL.companyName}.{" "}
            <a href={LEGAL.website} className="hover:text-neutral-900">
              {LEGAL.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-neutral-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <Link href="/refund" className="hover:text-neutral-900">
              Refunds
            </Link>
            <a href={`mailto:${LEGAL.supportEmail}`} className="hover:text-neutral-900">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
