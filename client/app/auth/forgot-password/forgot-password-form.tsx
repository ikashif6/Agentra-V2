"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { authInputClassName, authRadiusClass } from "@/components/auth/auth-panel-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { setSubdomain } from "@/lib/auth";
import { getWorkspaceDisplayHost } from "@/lib/workspace-host";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Valid email required"),
});

type FormData = z.infer<typeof schema>;

type ForgotPasswordFormProps = {
  workspace: string;
};

export function ForgotPasswordForm({ workspace }: ForgotPasswordFormProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    setSubdomain(workspace);
  }, [workspace]);

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    setFormError(null);
    try {
      await authApi.forgotPassword({ email: values.email });
      setSent(true);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Something went wrong. Please try again.");
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex justify-center">
          <div
            className={cn(
              "flex size-14 items-center justify-center bg-primary/10",
              authRadiusClass,
            )}
          >
            <MailCheck className="size-7 text-primary" />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Check your email</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If that email is registered for{" "}
            <span className="font-medium text-foreground">{getWorkspaceDisplayHost(workspace)}</span>
            , you&apos;ll receive a reset link shortly. It expires in 1 hour.
          </p>
        </div>

        <AuthFormAlert
          message="Haven't received it? Check your spam folder, or confirm you used the email for this account."
          variant="info"
        />

        <Link href="/auth/login" className="block">
          <Button
            type="button"
            variant="outline"
            className={`h-10 w-full font-semibold ${authRadiusClass}`}
          >
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your email for{" "}
          <span className="font-medium text-foreground">{getWorkspaceDisplayHost(workspace)}</span>{" "}
          and we&apos;ll send a reset link.
        </p>
      </div>

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

        {formError ? <AuthFormAlert message={formError} /> : null}

        <Button
          type="submit"
          className={`h-10 w-full font-semibold ${authRadiusClass}`}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
