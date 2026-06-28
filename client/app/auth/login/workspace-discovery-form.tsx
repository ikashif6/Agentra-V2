"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { onboardingApi } from "@/lib/api";
import {
  buildWorkspaceLoginUrl,
  isValidSubdomainFormat,
  normalizeSubdomainInput,
  SUBDOMAIN_REGEX,
} from "@/lib/workspace-host";

const schema = z.object({
  subdomain: z
    .string()
    .min(1, "Workspace subdomain is required")
    .regex(SUBDOMAIN_REGEX, "Use lowercase letters, numbers, and hyphens only"),
});

type FormData = z.infer<typeof schema>;

export function WorkspaceDiscoveryForm() {
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    setNotFound(false);

    const subdomain = normalizeSubdomainInput(values.subdomain);
    if (!isValidSubdomainFormat(subdomain)) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await onboardingApi.checkSubdomain(subdomain);
      if (data.data.available) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      window.location.assign(buildWorkspaceLoginUrl(subdomain));
    } catch {
      setNotFound(true);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back!</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
          Enter your workspace URL to continue to sign in.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          <Label htmlFor="subdomain">URL of your Agentraa workspace</Label>
          <div
            className={`flex items-center overflow-hidden border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${authRadiusClass}`}
          >
            <Input
              id="subdomain"
              {...register("subdomain")}
              placeholder="yourcompany"
              autoComplete="organization"
              className="rounded-none border-0 focus-visible:ring-0"
            />
            <span className="shrink-0 border-l border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              .agentraa.com
            </span>
          </div>
          {errors.subdomain ? (
            <p className="text-xs text-destructive">{errors.subdomain.message}</p>
          ) : null}
          {notFound ? (
            <p className="text-xs text-destructive">Agentraa workspace not found.</p>
          ) : null}
        </div>

        <Button
          type="submit"
          className={`h-10 w-full font-semibold ${authRadiusClass}`}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Continue
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        If you don&apos;t remember your workspace subdomain, reach out at{" "}
        <a href="mailto:support@agentraa.com" className="underline hover:text-foreground">
          support@agentraa.com
        </a>
        .
      </p>

      <p className="text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/onboarding" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
