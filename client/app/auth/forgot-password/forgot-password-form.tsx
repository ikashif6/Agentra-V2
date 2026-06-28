"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { setSubdomain } from "@/lib/auth";
import { getWorkspaceDisplayHost } from "@/lib/workspace-host";

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
    try {
      await authApi.forgotPassword({ email: values.email });
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div
            className="flex size-16 items-center justify-center rounded-full"
            style={{ background: "#FDEBE4" }}
          >
            <MailCheck className="size-8" style={{ color: "#D85A30" }} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reset link sent</h2>
          <p className="mt-2 text-sm text-gray-500">
            If that email is registered, you&apos;ll receive a reset link shortly. It expires in 1
            hour.
          </p>
        </div>
        <Link href="/auth/login" className="block w-full">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email for{" "}
          <span className="font-medium text-gray-700">{getWorkspaceDisplayHost(workspace)}</span> and
          we&apos;ll send a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="you@company.com"
            className="focus-visible:ring-[#D85A30]"
          />
          {errors.email ? <p className="text-xs text-red-500">{errors.email.message}</p> : null}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/auth/login" className="font-medium text-[#D85A30] hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
