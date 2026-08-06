import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthLogo } from "@/components/auth/auth-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-svh flex-col overflow-hidden"
      style={{ background: "#ef9070" } as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 blur-[12px]" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 aspect-square w-[175%] max-w-none -translate-x-1/2 -translate-y-[46%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/auth/pulse.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-contain blur-[5px]"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>
      </div>

      <header className="relative z-10 px-6 pt-6 sm:px-10">
        <AuthLogo href="/dashboard" imgClassName="h-7 w-auto brightness-0 invert sm:h-8" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-8 text-center sm:px-8">
        <div className="w-full max-w-[360px]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#1d1814] uppercase">
            Error 404
          </p>
          <h1 className="mt-3 text-[2.25rem] leading-tight font-semibold tracking-tight text-[#1d1814] sm:text-[2.5rem]">
            Page not found
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#1d1814]/72">
            This page doesn&apos;t exist or may have moved. Head back to your
            workspace to keep going.
          </p>

          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 h-10 w-full rounded-[10px] border-0 bg-[#1d1814] text-[13.5px] font-medium text-white shadow-none ring-0 hover:bg-[#1d1814]/90 focus-visible:border-transparent focus-visible:ring-0",
            )}
          >
            Back to workspace
          </Link>
          <Link
            href="/auth/login"
            className="mt-4 inline-block text-[13px] font-medium text-[#1d1814]/70 transition-colors hover:text-[#1d1814]"
          >
            Sign in instead
          </Link>
        </div>
      </main>
    </div>
  );
}
