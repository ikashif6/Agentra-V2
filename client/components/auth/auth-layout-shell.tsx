"use client";

import { usePathname } from "next/navigation";
import {
  authPageClassName,
  authPanelClassName,
} from "@/components/auth/auth-panel-background";
import { AuthLegalFooter } from "@/components/auth/auth-legal-footer";
import { AuthHeroPanel } from "@/components/auth/auth-hero-panel";
import { AuthLogo } from "@/components/auth/auth-logo";

const MINIMAL_PATHS = ["/auth/verify-email", "/auth/check-email"];

export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMinimal = MINIMAL_PATHS.some((p) => pathname?.startsWith(p));
  // Signup carries its own terms disclaimer, so it skips the pinned legal footer
  const isSignup = Boolean(pathname?.startsWith("/auth/signup"));

  if (isMinimal) {
    return <div className="min-h-svh bg-background">{children}</div>;
  }

  return (
    <div className={authPageClassName}>
      <div className={authPanelClassName}>
        <div className="relative z-10 shrink-0">
          <AuthLogo />
        </div>

        <div className="auth-scroll-area relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pt-2 pb-3">
          <div className="m-auto w-full max-w-md space-y-5">{children}</div>
        </div>

        {isSignup ? null : <AuthLegalFooter className="mt-auto pb-5 lg:pb-6" />}
      </div>

      <AuthHeroPanel />
    </div>
  );
}
