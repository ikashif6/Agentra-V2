"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, authApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { useAuth } from "@/contexts/AuthContext";
import SettingsPanelShell from "./settings-panel-shell";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Needs upper, lower, number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

type TwoFactorMode = "idle" | "enable_confirm" | "disable_confirm";

export default function PasswordSecurityPanel() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>("idle");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");

  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);

  const onSubmit = async (values: PasswordForm) => {
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      toast.success("Your password was updated. Please sign in again.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const startEnableTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      const { data } = await authApi.enableTwoFactor();
      setMaskedEmail(String(data.data?.maskedEmail || user?.email || ""));
      setOtp("");
      setTwoFactorMode("enable_confirm");
      toast.success("Verification code sent to your email");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start two-factor setup");
      toast.error(message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const startDisableTwoFactor = async () => {
    setTwoFactorBusy(true);
    try {
      const { data } = await authApi.disableTwoFactor();
      setMaskedEmail(String(data.data?.maskedEmail || user?.email || ""));
      setOtp("");
      setTwoFactorMode("disable_confirm");
      toast.success("Verification code sent to your email");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not start two-factor disable");
      toast.error(message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const confirmTwoFactor = async () => {
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code from your email");
      return;
    }

    setTwoFactorBusy(true);
    try {
      if (twoFactorMode === "enable_confirm") {
        await authApi.confirmEnableTwoFactor({ otp: code });
        toast.success("Two-factor authentication enabled");
      } else {
        await authApi.confirmDisableTwoFactor({ otp: code });
        toast.success("Two-factor authentication disabled");
      }
      setTwoFactorMode("idle");
      setOtp("");
      await refreshUser();
    } catch (err: unknown) {
      const { message } = getApiError(err, "Invalid verification code");
      toast.error(message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  return (
    <SettingsPanelShell
      title="Password & security"
      description="Keep your sign-in details up to date"
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Current password</Label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              {...form.register("currentPassword")}
              className="pr-10 focus-visible:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.currentPassword ? (
            <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">New password</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              {...form.register("newPassword")}
              className="pr-10 focus-visible:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.newPassword ? (
            <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Confirm new password</Label>
          <Input
            type="password"
            {...form.register("confirmPassword")}
            className="focus-visible:ring-primary/30"
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
          {[
            "At least 8 characters",
            "One uppercase letter",
            "One lowercase letter",
            "One number",
          ].map((rule) => (
            <p key={rule} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              {rule}
            </p>
          ))}
        </div>

        <Separator />
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update password
          </Button>
        </div>
      </form>

      <Separator className="my-8" />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Two-factor authentication</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            When turned on, signing in with a password also asks for a one-time code we email you.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {twoFactorEnabled ? "Enabled" : "Not enabled"}
            </p>
            <p className="text-xs text-muted-foreground">
              {twoFactorEnabled
                ? "A verification code from email is required after your password."
                : "You can sign in with your password alone."}
            </p>
          </div>
          {twoFactorMode === "idle" ? (
            twoFactorEnabled ? (
              <Button
                type="button"
                variant="outline"
                disabled={twoFactorBusy}
                onClick={() => void startDisableTwoFactor()}
              >
                {twoFactorBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Disable
              </Button>
            ) : (
              <Button
                type="button"
                disabled={twoFactorBusy}
                onClick={() => void startEnableTwoFactor()}
              >
                {twoFactorBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enable
              </Button>
            )
          ) : null}
        </div>

        {twoFactorMode !== "idle" ? (
          <div className="space-y-3 rounded-xl border border-border/80 px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <span className="font-medium text-foreground">{maskedEmail || "your email"}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Verification code</Label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="max-w-[12rem] tracking-[0.35em] focus-visible:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={twoFactorBusy || otp.length !== 6}
                onClick={() => void confirmTwoFactor()}
              >
                {twoFactorBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={twoFactorBusy}
                onClick={() => {
                  setTwoFactorMode("idle");
                  setOtp("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsPanelShell>
  );
}
