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
    .min(1, "Workspace name is required")
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
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Sign in to your workspace
        </h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">
          We&apos;ll take you to the workspace your team already uses.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          <Label htmlFor="subdomain">Workspace name</Label>
          <div
            className={`flex h-10 items-stretch overflow-hidden border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${authRadiusClass}`}
          >
            <Input
              id="subdomain"
              {...register("subdomain")}
              placeholder="brightpath"
              autoComplete="organization"
              className="h-full min-h-0 rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <span className="flex shrink-0 items-center border-l border-input bg-muted px-3 text-sm text-muted-foreground">
              .agentraa.com
            </span>
          </div>
          {errors.subdomain ? (
            <p className="text-xs text-destructive">{errors.subdomain.message}</p>
          ) : null}
          {notFound ? (
            <p className="text-xs text-destructive">
              We couldn&apos;t find a workspace with that name.
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          className={`h-10 w-full font-semibold ${authRadiusClass}`}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Go to workspace
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        New to Agentra?{" "}
        <Link href="/auth/signup" className="font-medium text-primary hover:underline">
          Start free trial
        </Link>
      </p>
    </div>
  );
}
