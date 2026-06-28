"use client";

import { useEffect, useState } from "react";
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
import { authRadiusClass } from "@/components/auth/auth-panel-background";
import { authApi } from "@/lib/api";
import { setSubdomain } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Company, User } from "@/lib/types";
import { buildMainLoginUrl, getWorkspaceDisplayHost } from "@/lib/workspace-host";

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
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
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
      const { data } = await authApi.login({
        email: values.email,
        password: values.password,
        workspace,
      });

      const { accessToken, refreshToken, user, company } = data.data;
      login(accessToken, refreshToken, user as User, company as Company);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back!</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to{" "}
          <span className="font-medium text-foreground">{getWorkspaceDisplayHost(workspace)}</span>
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
            className={authRadiusClass}
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
              className={`${authRadiusClass} pr-10`}
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

        <Button
          type="submit"
          className={`h-10 w-full font-semibold ${authRadiusClass}`}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <a href={buildMainLoginUrl()} className="font-medium text-primary hover:underline">
          Sign in to a different workspace
        </a>
      </p>
    </div>
  );
}
