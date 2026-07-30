"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { authApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { setSubdomain } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import type { Company, User } from "@/lib/types";

function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Missing sign-in code");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.completeOAuthLogin(code);
        if (cancelled) return;
        const { accessToken, refreshToken, user, company } = data.data;
        if (company?.subdomain) setSubdomain(company.subdomain);
        login(accessToken, refreshToken, user as User, company as Company);
        router.replace("/dashboard");
      } catch (err: unknown) {
        if (cancelled) return;
        const { message } = getApiError(err, "Social sign-in failed");
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, login, router]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <AuthFormAlert message={error} />
          <a href="/auth/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </a>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
        </>
      )}
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
