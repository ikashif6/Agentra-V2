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

export default function MagicLinkPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      setSubdomain(values.subdomain);
      await authApi.requestMagicLink({ email: values.email });
      setSent(true);
    } catch {
      toast.error("Failed to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#FDEBE4" }}>
            <MailCheck className="h-8 w-8" style={{ color: "#D85A30" }} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Check your inbox</h2>
          <p className="mt-2 text-sm text-gray-500">
            We sent a sign-in link to your email. Open it within 15 minutes to continue.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sign in with Magic Link</h2>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll email you a secure link so you can sign in without a password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="subdomain">Workspace subdomain</Label>
          <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-gray-200 transition-all focus-within:border-[#D85A30] focus-within:ring-1 focus-within:ring-[#D85A30]">
            <Input id="subdomain" {...register("subdomain")} placeholder="yourcompany"
              className="h-full min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
            <span className="flex shrink-0 items-center border-l border-gray-200 bg-gray-50 px-3 text-sm text-gray-400">
              .agentraa.com
            </span>
          </div>
          {errors.subdomain && <p className="text-xs text-red-500">{errors.subdomain.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" {...register("email")} placeholder="you@company.com"
            className="focus-visible:ring-[#D85A30]" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Send Magic Link
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/auth/login" className="text-[#D85A30] font-medium hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
