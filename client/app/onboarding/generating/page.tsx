"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLogo } from "@/components/auth/auth-logo";
import { useAuth } from "@/contexts/AuthContext";
import { getSubdomain, isAuthenticated } from "@/lib/auth";
import { getWorkspaceDisplayHost } from "@/lib/workspace-host";
import { GeneratingWorkspaceScene } from "@/components/onboarding/generating-workspace-scene";

const GENERATING_MS = 4500;

export default function GeneratingWorkspacePage() {
  const router = useRouter();
  const { company, loading } = useAuth();

  const subdomain = company?.subdomain ?? getSubdomain() ?? "";

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }

    const timer = window.setTimeout(() => {
      router.replace("/dashboard");
    }, GENERATING_MS);

    return () => window.clearTimeout(timer);
  }, [loading, router]);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-6 py-12">
      <AuthLogo href="/dashboard" imgClassName="h-7" />

      <h1 className="mt-10 text-center text-[1.35rem] font-semibold tracking-tight text-[#111827] sm:text-[1.5rem]">
        Preparing your Agentra workspace…
      </h1>

      {subdomain ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Setting up{" "}
          <span className="font-medium text-foreground">
            {getWorkspaceDisplayHost(subdomain)}
          </span>
        </p>
      ) : null}

      <GeneratingWorkspaceScene />
    </div>
  );
}
