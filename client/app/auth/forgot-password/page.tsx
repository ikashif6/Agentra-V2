"use client";

import { useState } from "react";
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

const schema = z.object({
  subdomain: z.string().min(1, "Workspace subdomain is required"),
  email: z.string().email("Valid email required"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      setSubdomain(values.subdomain);
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#FFF0EB" }}>
            <MailCheck className="h-8 w-8" style={{ color: "#E8470A" }} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reset link sent</h2>
          <p className="mt-2 text-sm text-gray-500">
            If that email is registered, you&apos;ll receive a reset link shortly. It expires in 1 hour.
          </p>
        </div>
      <Link href="/auth/login" className="w-full">
        <Button variant="outline" className="w-full">Back to sign in</Button>
      </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your workspace and email and we&apos;ll send a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="subdomain">Workspace subdomain</Label>
          <div className="flex items-center rounded-lg border border-gray-200 focus-within:border-[#E8470A] focus-within:ring-1 focus-within:ring-[#E8470A] overflow-hidden transition-all">
            <Input id="subdomain" {...register("subdomain")} placeholder="yourcompany"
              className="border-0 focus-visible:ring-0 rounded-none flex-1" />
            <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2 shrink-0">
              .agentraa.com
            </span>
          </div>
          {errors.subdomain && <p className="text-xs text-red-500">{errors.subdomain.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" {...register("email")} placeholder="you@company.com"
            className="focus-visible:ring-[#E8470A]" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={loading}
          style={{ background: "#E8470A" }}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Send Reset Link
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/auth/login" className="text-[#E8470A] font-medium hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
