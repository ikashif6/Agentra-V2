"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthenticated } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingSetupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated()) {
      router.replace("/auth/login");
      return;
    }
    if (user?.onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || !user || user.onboardingCompleted) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return <OnboardingWizard />;
}
