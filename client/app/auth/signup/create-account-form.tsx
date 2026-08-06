"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { authInputClassName, authRadiusClass } from "@/components/auth/auth-panel-background";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/social-auth-icons";
import { authApi, onboardingApi } from "@/lib/api";
import { SITE_LEGAL } from "@/lib/site";
import { getApiError } from "@/lib/api-error";
import {
  deriveSubdomainFromWebsite,
  getWorkspaceDisplayHost,
  isValidSubdomainFormat,
  normalizeWebsiteUrl,
} from "@/lib/workspace-host";
import { cn } from "@/lib/utils";

const schema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name is too long"),
  websiteUrl: z
    .string()
    .min(1, "Website URL is required")
    .refine((value) => {
      try {
        const url = new URL(normalizeWebsiteUrl(value));
        return Boolean(url.hostname);
      } catch {
        return false;
      }
    }, "Enter a valid website URL"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "One uppercase letter")
    .regex(/[a-z]/, "One lowercase letter")
    .regex(/\d/, "One number")
    .regex(/[^A-Za-z0-9]/, "One special character"),
});

type FormData = z.infer<typeof schema>;
type Step = 1 | 2 | 3;
type SocialProvider = "google" | "microsoft";

const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { id: "lower", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { id: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  {
    id: "special",
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="space-y-1.5 pt-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                met
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent",
              )}
              aria-hidden="true"
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
            <span className={met ? "text-foreground" : "text-muted-foreground"}>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CreateAccountForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [subdomainStatus, setSubdomainStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      websiteUrl: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const { onBlur: onPasswordBlur, ...passwordField } = register("password");

  const websiteUrl = watch("websiteUrl");
  const email = watch("email") ?? "";
  const password = watch("password") ?? "";
  const isSocialPath = socialProvider !== null;

  const derivedSubdomain = useMemo(
    () => deriveSubdomainFromWebsite(websiteUrl ?? ""),
    [websiteUrl],
  );

  useEffect(() => {
    if (searchParams.get("oauth") === "error") {
      setFormError(searchParams.get("message") || "Social signup failed. Please try again.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!derivedSubdomain || derivedSubdomain.length < 2) {
      setSubdomainStatus("idle");
      return;
    }

    if (!isValidSubdomainFormat(derivedSubdomain)) {
      setSubdomainStatus("invalid");
      return;
    }

    const timer = window.setTimeout(async () => {
      setSubdomainStatus("checking");
      try {
        const { data } = await onboardingApi.checkSubdomain(derivedSubdomain);
        setSubdomainStatus(data.data.available ? "available" : "taken");
      } catch {
        setSubdomainStatus("idle");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [derivedSubdomain]);

  const goBack = () => {
    setFormError(null);
    if (step === 3 && isSocialPath) {
      setSocialProvider(null);
      setStep(1);
      return;
    }
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(1);
    }
  };

  const continueFromEmail = async () => {
    setFormError(null);
    const valid = await trigger("email");
    if (!valid) return;
    setSocialProvider(null);
    setStep(2);
  };

  const continueFromProfile = async () => {
    setFormError(null);
    const valid = await trigger(["firstName", "lastName", "email", "password"]);
    if (!valid) return;
    setStep(3);
  };

  const beginSocialSignup = (provider: SocialProvider) => {
    setFormError(null);
    setSocialProvider(provider);
    setStep(3);
  };

  const onSubmit = async (values: FormData) => {
    const subdomain = deriveSubdomainFromWebsite(values.websiteUrl);
    setFormError(null);

    if (!isValidSubdomainFormat(subdomain)) {
      setFormError("Could not derive a valid workspace URL from that website.");
      return;
    }

    if (subdomainStatus === "taken") {
      setFormError("That workspace URL is already taken. Try a different website.");
      return;
    }

    if (isSocialPath && socialProvider) {
      setLoading(true);
      try {
        const payload = {
          companyName: values.companyName.trim(),
          subdomain,
          website: normalizeWebsiteUrl(values.websiteUrl),
          returnOrigin: window.location.origin,
        };
        const { data } =
          socialProvider === "google"
            ? await authApi.googleSignupUrl(payload)
            : await authApi.microsoftSignupUrl(payload);
        const url = data.data?.url as string | undefined;
        if (!url) throw new Error("Missing OAuth URL");
        window.location.assign(url);
      } catch (err: unknown) {
        const { message } = getApiError(err, `Unable to start ${socialProvider} signup`);
        setFormError(message);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await onboardingApi.onboard({
        plan_id: "pro",
        companyName: values.companyName,
        subdomain,
        website: normalizeWebsiteUrl(values.websiteUrl),
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        billingCycle: "monthly",
      });

      const host = getWorkspaceDisplayHost(subdomain);
      window.location.assign(
        `/auth/check-email?${new URLSearchParams({
          email: values.email,
          workspace: host,
        }).toString()}`,
      );
    } catch (err: unknown) {
      const { message } = getApiError(err, "Something went wrong. Please try again.");
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === 1
      ? "Create your account"
      : step === 2
        ? "About you"
        : isSocialPath
          ? "Your workspace"
          : "Your company";

  const subtitle =
    step === 1
      ? "Create your Agentra workspace and begin a 14-day free trial."
      : step === 2
        ? "A few details to get your account ready."
        : isSocialPath
          ? `Share a little about your company to continue with ${socialProvider === "google" ? "Google" : "Microsoft"}.`
          : "A little about your company helps us set up the right workspace.";

  return (
    <div className="space-y-6">
      <div>
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {step === 1 ? (
        <div className="space-y-6">
          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className={cn("h-10 w-full justify-center gap-2 px-3 font-medium", authRadiusClass)}
              disabled={loading}
              onClick={() => beginSocialSignup("google")}
            >
              <GoogleIcon className="size-4" />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn("h-10 w-full justify-center gap-2 px-3 font-medium", authRadiusClass)}
              disabled={loading}
              onClick={() => beginSocialSignup("microsoft")}
            >
              <MicrosoftIcon className="size-4" />
              Continue with Microsoft
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@yourcompany.com"
                className={authInputClassName}
                {...register("email")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void continueFromEmail();
                  }
                }}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            {formError ? <AuthFormAlert message={formError} /> : null}

            <Button
              type="button"
              className={`h-10 w-full font-semibold ${authRadiusClass}`}
              disabled={loading}
              onClick={() => void continueFromEmail()}
            >
              Continue
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree to our{" "}
            <a
              href={SITE_LEGAL.termsAndConditions}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Terms &amp; Conditions
            </a>{" "}
            and{" "}
            <a
              href={SITE_LEGAL.privacyPolicy}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Privacy Policy
            </a>
            .
          </p>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Alex"
                className={authInputClassName}
                {...register("firstName")}
              />
              {errors.firstName ? (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="Rivera"
                className={authInputClassName}
                {...register("lastName")}
              />
              {errors.lastName ? (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-confirm">Email</Label>
            <div className="relative">
              <Input
                id="email-confirm"
                type="email"
                autoComplete="email"
                className={cn(authInputClassName, "pr-14")}
                {...register("email")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setFormError(null);
                  setStep(1);
                }}
              >
                Edit
              </button>
            </div>
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                className={cn(authInputClassName, "pr-10")}
                {...passwordField}
                onFocus={() => setPasswordFocused(true)}
                onBlur={(event) => {
                  setPasswordFocused(false);
                  void onPasswordBlur(event);
                }}
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
            {passwordFocused || password.length > 0 ? (
              <PasswordRequirements password={password} />
            ) : null}
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : null}
          </div>

          {formError ? <AuthFormAlert message={formError} /> : null}

          <Button
            type="button"
            className={`h-10 w-full font-semibold ${authRadiusClass}`}
            disabled={loading}
            onClick={() => void continueFromProfile()}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              autoComplete="organization"
              placeholder="BrightPath Retail"
              className={authInputClassName}
              {...register("companyName")}
            />
            {errors.companyName ? (
              <p className="text-xs text-destructive">{errors.companyName.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL</Label>
            <Input
              id="websiteUrl"
              autoComplete="url"
              placeholder="yourbrand.com"
              className={authInputClassName}
              {...register("websiteUrl")}
            />
            {derivedSubdomain && isValidSubdomainFormat(derivedSubdomain) ? (
              <p className="text-xs text-muted-foreground">
                Workspace:{" "}
                <span className="font-medium text-foreground">
                  {getWorkspaceDisplayHost(derivedSubdomain)}
                </span>
              </p>
            ) : null}
            {subdomainStatus === "checking" ? (
              <p className="text-xs text-muted-foreground">Checking workspace availability…</p>
            ) : null}
            {subdomainStatus === "available" ? (
              <p className="text-xs text-emerald-600">Workspace URL is available</p>
            ) : null}
            {subdomainStatus === "taken" ? (
              <p className="text-xs text-destructive">Workspace URL is already taken</p>
            ) : null}
            {subdomainStatus === "invalid" ? (
              <p className="text-xs text-destructive">
                Enter a website with a valid subdomain (e.g. brightpath.com)
              </p>
            ) : null}
            {errors.websiteUrl ? (
              <p className="text-xs text-destructive">{errors.websiteUrl.message}</p>
            ) : null}
          </div>

          {!isSocialPath && email ? (
            <p className="text-xs text-muted-foreground">
              Creating workspace for{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
          ) : null}

          {formError ? <AuthFormAlert message={formError} /> : null}

          <Button
            type="submit"
            className={`h-10 w-full font-semibold ${authRadiusClass}`}
            disabled={loading || subdomainStatus === "taken" || subdomainStatus === "invalid"}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {isSocialPath
              ? `Continue with ${socialProvider === "google" ? "Google" : "Microsoft"}`
              : "Create account"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
