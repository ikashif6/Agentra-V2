"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { authInputClassName, authRadiusClass } from "@/components/auth/auth-panel-background";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/social-auth-icons";
import { authApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { setSubdomain } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Company, User } from "@/lib/types";
import { getWorkspaceDisplayHost } from "@/lib/workspace-host";
import { useMainLoginUrl } from "@/hooks/use-main-login-url";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

type TwoFactorState = {
  email: string;
  maskedEmail: string;
};

type WorkspaceLoginFormProps = {
  workspace: string;
};

export function WorkspaceLoginForm({ workspace }: WorkspaceLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const mainLoginUrl = useMainLoginUrl();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<{ message: string; code?: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorState | null>(null);
  const [otp, setOtp] = useState("");
  const [otpUnlocked, setOtpUnlocked] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const emailValue = watch("email");

  useEffect(() => {
    setSubdomain(workspace);
  }, [workspace]);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      setSuccessMessage("Your account is ready. Please verify your email, then sign in.");
      router.replace("/auth/login", { scroll: false });
    }
    if (searchParams.get("verified") === "1") {
      setSuccessMessage("Your email is verified. You can sign in now.");
      router.replace("/auth/login", { scroll: false });
    }
    if (searchParams.get("oauth") === "error") {
      setFormError({
        message: searchParams.get("message") || "Social sign-in failed. Please try again.",
      });
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router]);

  const startSocialLogin = async (provider: "google" | "microsoft") => {
    setLoading(true);
    setFormError(null);
    try {
      const returnOrigin = window.location.origin;
      const { data } =
        provider === "google"
          ? await authApi.googleLoginUrl(workspace, returnOrigin)
          : await authApi.microsoftLoginUrl(workspace, returnOrigin);
      const url = data.data?.url as string | undefined;
      if (!url) throw new Error("Missing OAuth URL");
      window.location.assign(url);
    } catch (err: unknown) {
      const { message } = getApiError(err, `Unable to start ${provider} sign-in`);
      setFormError({ message });
      setLoading(false);
    }
  };

  const completeLogin = (payload: {
    accessToken: string;
    refreshToken: string;
    user: User;
    company: Company;
  }) => {
    login(payload.accessToken, payload.refreshToken, payload.user, payload.company);
    router.push("/dashboard");
  };

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const { data } = await authApi.login({
        email: values.email,
        password: values.password,
        workspace,
      });

      if (data.data?.requiresTwoFactor) {
        setTwoFactor({
          email: String(data.data.email || values.email),
          maskedEmail: String(data.data.maskedEmail || values.email),
        });
        setOtp("");
        setOtpUnlocked(false);
        setSuccessMessage(null);
        return;
      }

      const { accessToken, refreshToken, user, company } = data.data;
      completeLogin({
        accessToken,
        refreshToken,
        user: user as User,
        company: company as Company,
      });
    } catch (err: unknown) {
      const { message, code } = getApiError(err, "Unable to sign in. Please try again.");
      setFormError({ message, code });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactor) return;
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      setFormError({ message: "Please enter the 6-digit code from your email." });
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const { data } = await authApi.verifyTwoFactor({
        email: twoFactor.email,
        otp: code,
        workspace,
      });
      const { accessToken, refreshToken, user, company } = data.data;
      completeLogin({
        accessToken,
        refreshToken,
        user: user as User,
        company: company as Company,
      });
    } catch (err: unknown) {
      const { message, code } = getApiError(err, "Invalid verification code.");
      setFormError({ message, code });
    } finally {
      setLoading(false);
    }
  };

  const onResendTwoFactor = async () => {
    if (!twoFactor) return;
    setResending(true);
    setFormError(null);
    try {
      const { data } = await authApi.resendTwoFactor({
        email: twoFactor.email,
        workspace,
      });
      if (data.data?.maskedEmail) {
        setTwoFactor((prev) =>
          prev ? { ...prev, maskedEmail: String(data.data.maskedEmail) } : prev,
        );
      }
      setSuccessMessage("We've sent a new verification code.");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not resend code. Please try again.");
      setFormError({ message });
    } finally {
      setResending(false);
    }
  };

  const checkEmailHref =
    emailValue && z.string().email().safeParse(emailValue).success
      ? `/auth/check-email?${new URLSearchParams({
          email: emailValue,
          workspace: getWorkspaceDisplayHost(workspace),
        }).toString()}`
      : "/auth/check-email";

  if (twoFactor) {
    const goBackToPassword = () => {
      setTwoFactor(null);
      setOtp("");
      setOtpUnlocked(false);
      setFormError(null);
      setSuccessMessage(null);
    };

    return (
      <div className="space-y-5">
        <div>
          <button
            type="button"
            onClick={goBackToPassword}
            disabled={loading}
            className="mb-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            aria-label="Back to password"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Check your email</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{twoFactor.maskedEmail}</span>
          </p>
        </div>

        {successMessage ? <AuthFormAlert message={successMessage} variant="success" /> : null}

        <form
          key="2fa-otp-form"
          autoComplete="off"
          onSubmit={(e) => void onVerifyTwoFactor(e)}
          className="space-y-4"
        >
          {/* Soak up browser email/password autofill so it doesn't land in the OTP field */}
          <div
            aria-hidden="true"
            className="h-0 w-0 overflow-hidden opacity-0"
            style={{ position: "absolute", left: "-10000px" }}
          >
            <input type="text" name="username" autoComplete="username" tabIndex={-1} defaultValue="" />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} defaultValue="" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="two-factor-otp">Verification code</Label>
            <Input
              id="two-factor-otp"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={6}
              value={otp}
              readOnly={!otpUnlocked}
              onFocus={() => setOtpUnlocked(true)}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className={cn(authInputClassName, "tracking-[0.35em]")}
            />
          </div>

          {formError ? <AuthFormAlert message={formError.message} /> : null}

          <Button
            type="submit"
            className={`h-10 w-full font-semibold ${authRadiusClass}`}
            disabled={loading || otp.length !== 6}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Verify and sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={resending || loading}
            onClick={() => void onResendTwoFactor()}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to{" "}
          <span className="font-medium text-foreground">{getWorkspaceDisplayHost(workspace)}</span>
        </p>
      </div>

      {successMessage ? <AuthFormAlert message={successMessage} variant="success" /> : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            placeholder="you@company.com"
            className={authInputClassName}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-muted-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
              placeholder="••••••••"
              className={cn(authInputClassName, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        {formError ? (
          <div className="space-y-2">
            <AuthFormAlert message={formError.message} />
            {formError.code === "EMAIL_NOT_VERIFIED" ? (
              <p className="text-xs text-muted-foreground">
                Didn&apos;t get the email?{" "}
                <Link href={checkEmailHref} className="font-medium text-primary hover:underline">
                  Check your inbox or resend the link
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          className={`h-10 w-full font-semibold ${authRadiusClass}`}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <div className="grid gap-3">
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-center gap-2 px-3 font-medium", authRadiusClass)}
          disabled={loading}
          onClick={() => void startSocialLogin("google")}
        >
          <GoogleIcon className="size-4" />
          Log in with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-center gap-2 px-3 font-medium", authRadiusClass)}
          disabled={loading}
          onClick={() => void startSocialLogin("microsoft")}
        >
          <MicrosoftIcon className="size-4" />
          Log in with Microsoft
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <a href={mainLoginUrl} className="font-medium text-primary hover:underline">
          Sign in to a different workspace
        </a>
      </p>
    </div>
  );
}
