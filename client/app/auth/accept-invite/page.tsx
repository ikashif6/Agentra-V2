"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Company, User } from "@/lib/types";
import { Suspense } from "react";

const schema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  password: z.string()
    .min(8, "At least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must have upper, lower, and a number"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormData) => {
    if (!token) { toast.error("Invalid invite link"); return; }
    setLoading(true);
    try {
      const { data } = await authApi.acceptInvite({ token, password: values.password });
      const { accessToken, refreshToken, user, company } = data.data;
      login(accessToken, refreshToken, user as User, company as Company);
      toast.success("Welcome aboard!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Invite link invalid or expired";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Accept your invitation</h2>
        <p className="mt-1 text-sm text-gray-500">Set your name and password to complete signup.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" {...register("firstName")} placeholder="Jane"
              className="focus-visible:ring-[#E8470A]" />
            {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" {...register("lastName")} placeholder="Doe"
              className="focus-visible:ring-[#E8470A]" />
            {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
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

        <div className="space-y-1">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" {...register("confirmPassword")}
            placeholder="••••••••" className="focus-visible:ring-[#E8470A]" />
          {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={loading}
          style={{ background: "#E8470A" }}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Complete Signup
        </Button>
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">Loading...</div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
