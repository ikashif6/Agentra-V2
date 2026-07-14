"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthenticated } from "@/lib/auth";
import { fetchWorkspaceSetupStatus } from "@/lib/home-setup-status";
import { WorkspaceSetupWizard } from "@/components/setup/workspace-setup-wizard";
import type { WorkspaceSetupStepId } from "@/lib/workspace-setup";

function SetupPageInner() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [completedIds, setCompletedIds] = useState<WorkspaceSetupStepId[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    if (user && !["owner", "admin"].includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await fetchWorkspaceSetupStatus();
      setCompletedIds(
        status.steps.filter((step) => step.done).map((step) => step.id as WorkspaceSetupStepId),
      );
    } catch {
      // Keep previous chips on transient errors
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (!["owner", "admin"].includes(user.role)) return;

    let cancelled = false;
    (async () => {
      try {
        await refreshStatus();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, refreshStatus]);

  if (loading || !user || !ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceSetupWizard completedIds={completedIds} onRefreshStatus={refreshStatus} />
  );
}

export default function WorkspaceSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <SetupPageInner />
    </Suspense>
  );
}
