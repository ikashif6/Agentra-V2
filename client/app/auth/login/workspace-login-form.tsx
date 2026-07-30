"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

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
      setSuccessMessage("Account created! Check your email to verify, then sign in.");
      router.replace("/auth/login", { scroll: false });
    }
    if (searchParams.get("verified") === "1") {
      setSuccessMessage("Email verified! You can sign in now.");
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
    if (provider === "microsoft") {
      toast.message("Microsoft sign-in is coming soon.");
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      const returnOrigin = window.location.origin;
      const { data } = await authApi.googleLoginUrl(workspace, returnOrigin);
      const url = data.data?.url as string | undefined;
      if (!url) throw new Error("Missing OAuth URL");
      window.location.assign(url);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Unable to start Google sign-in");
      setFormError({ message });
      setLoading(false);
    }
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

      const { accessToken, refreshToken, user, company } = data.data;
      login(accessToken, refreshToken, user as User, company as Company);
      router.push("/dashboard");
    } catch (err: unknown) {
      const { message, code } = getApiError(err, "Unable to sign in. Please try again.");
      setFormError({ message, code });
    } finally {
      setLoading(false);
    }
  };

  const checkEmailHref =
    emailValue && z.string().email().safeParse(emailValue).success
      ? `/auth/check-email?${new URLSearchParams({
          email: emailValue,
          workspace: getWorkspaceDisplayHost(workspace),
        }).toString()}`
      : "/auth/check-email";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back!</h1>
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

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className={`h-10 w-full ${authRadiusClass}`}
          disabled={loading}
          onClick={() => void startSocialLogin("google")}
        >
          <GoogleIcon className="size-4" />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`h-10 w-full ${authRadiusClass}`}
          disabled={loading}
          onClick={() => void startSocialLogin("microsoft")}
        >
          <MicrosoftIcon className="size-4" />
          Microsoft
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
