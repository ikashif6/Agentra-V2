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
import { api } from "@/lib/api";
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

export default function PasswordSecurityPanel() {
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (values: PasswordForm) => {
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      toast.success("Password changed. Please log in again.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanelShell
      title="Password & security"
      description="Update your sign-in credentials"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-600"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.currentPassword ? (
            <p className="text-xs text-red-500">{form.formState.errors.currentPassword.message}</p>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-600"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.newPassword ? (
            <p className="text-xs text-red-500">{form.formState.errors.newPassword.message}</p>
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
            <p className="text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
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
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
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
    </SettingsPanelShell>
  );
}
