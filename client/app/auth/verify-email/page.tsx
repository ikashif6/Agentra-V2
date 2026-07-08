"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { AuthLogo } from "@/components/auth/auth-logo";
import { authApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { useAuth } from "@/contexts/AuthContext";
import { setSubdomain } from "@/lib/auth";
import { Company, User } from "@/lib/types";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMessage("This verification link is missing a token. Use the link from your email.");
      return;
    }

    authApi
      .verifyEmail({ token })
      .then(({ data }) => {
        const payload = data.data;
        if (payload.accessToken && payload.refreshToken && payload.user && payload.company) {
          login(
            payload.accessToken,
            payload.refreshToken,
            payload.user as User,
            payload.company as Company,
          );
          setSubdomain(payload.company.subdomain);
          router.replace("/dashboard");
          return;
        }
        router.replace("/auth/login?verified=1");
      })
      .catch((err: unknown) => {
        const { message } = getApiError(
          err,
          "This verification link is invalid or has expired. Request a new one from the sign-in page.",
        );
        setStatus("error");
        setErrorMessage(message);
      });
  }, [searchParams, login, router]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AuthLogo href="/auth/login" />
        </div>

        {status === "loading" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your email...</p>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <h1 className="text-center text-xl font-semibold text-foreground">Verification failed</h1>
            {errorMessage ? <AuthFormAlert message={errorMessage} /> : null}
            <p className="text-center text-sm text-muted-foreground">
              <a href="/auth/login" className="font-medium text-primary hover:underline">
                Back to sign in
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
