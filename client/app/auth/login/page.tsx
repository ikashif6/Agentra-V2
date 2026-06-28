// app/auth/login/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Company, User } from "@/lib/types";

const schema = z.object({
  subdomain: z.string().min(1, "Workspace subdomain is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      // ✅ SIMPLE FIX: Add subdomain as query parameter
      const { data } = await authApi.login({
        email: values.email, 
        password: values.password,
        workspace: values.subdomain // Send subdomain in request body
      });
      
      const { accessToken, refreshToken, user, company } = data.data;
      login(accessToken, refreshToken, user as User, company as Company);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sign in to your workspace</h2>
        <p className="mt-1 text-sm text-gray-500">Enter your workspace subdomain and credentials</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="subdomain">Workspace subdomain</Label>
          <div className="flex items-center rounded-lg border border-gray-200 focus-within:border-[#E8470A] focus-within:ring-1 focus-within:ring-[#E8470A] transition-all overflow-hidden">
            <Input
              id="subdomain"
              {...register("subdomain")}
              placeholder="yourcompany"
              className="border-0 focus-visible:ring-0 rounded-none flex-1"
            />
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

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/auth/forgot-password" className="text-xs text-[#E8470A] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input id="password" type={showPwd ? "text" : "password"} {...register("password")}
              placeholder="••••••••" className="pr-10 focus-visible:ring-[#E8470A]" />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={loading}
          style={{ background: "#E8470A" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Sign in
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-gray-400">
          or
        </span>
      </div>

      <Link href="/auth/magic-link" className="w-full">
        <Button variant="outline" className="w-full">Sign in with Magic Link</Button>
      </Link>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have a workspace?{" "}
        <Link href="/onboarding" className="text-[#E8470A] font-medium hover:underline">
          Create one free
        </Link>
      </p>
    </div>
  );
}