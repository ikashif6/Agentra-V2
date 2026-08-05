import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL, PORTAL_ORIGIN } from "@/lib/legal";

export const metadata: Metadata = {
  title: `${LEGAL.productName} — Sign in`,
  description: `${LEGAL.productName} customer support workspace. Sign in to your account or create one.`,
  alternates: {
    canonical: PORTAL_ORIGIN,
  },
};

export default function RootPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-50 text-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.06),_transparent_55%)]"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-10 sm:py-14">
        <header>
          <Image
            src="/agentraa-logo.svg"
            alt={LEGAL.companyName}
            width={290}
            height={65}
            priority
            className="h-9 w-auto"
          />
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
            {LEGAL.productName}
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-500">
            Customer support workspace for your team. Sign in to continue, or create an
            account.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Sign up
            </Link>
          </div>
        </main>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-900">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy
          </Link>
          <Link href="/refund" className="hover:text-neutral-900">
            Refund policy
          </Link>
          <a href={`mailto:${LEGAL.supportEmail}`} className="hover:text-neutral-900">
            Contact
          </a>
        </footer>
      </div>
    </div>
  );
}
