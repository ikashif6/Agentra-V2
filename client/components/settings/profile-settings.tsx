"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api, uploadApi } from "@/lib/api";
import { resizeImageToSquare } from "@/lib/resize-image";
import { getUserTimezone } from "@/lib/user-timezone";
import { getTimezoneOptions } from "@/lib/timezones";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  firstName: z.string().min(1, "Required").max(50),
  lastName: z.string().min(1, "Required").max(50),
  bio: z.string().max(280).optional(),
  timezone: z.string().min(1),
  dateFormat: z.enum(["DMY", "MDY"]),
  timeFormat: z.enum(["12h", "24h"]),
});

type ProfileForm = z.infer<typeof profileSchema>;

function initials(firstName?: string, lastName?: string) {
  const first = firstName?.trim()[0] ?? "";
  const last = lastName?.trim()[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function formatDateExample(format: "DMY" | "MDY") {
  const date = new Date(2026, 0, 1);
  if (format === "DMY") {
    return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function RadioOption({
  name,
  value,
  checked,
  label,
  description,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  description?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1 py-2 transition-colors hover:border-border/60">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export default function ProfileSettings() {
  const { user, company, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const timezoneOptions = getTimezoneOptions();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      bio: user?.bio ?? "",
      timezone: getUserTimezone(user, company),
      dateFormat: user?.preferences?.dateFormat ?? "MDY",
      timeFormat: user?.preferences?.timeFormat ?? "12h",
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      bio: user.bio ?? "",
      timezone: getUserTimezone(user, company),
      dateFormat: user.preferences?.dateFormat ?? "MDY",
      timeFormat: user.preferences?.timeFormat ?? "12h",
    });
  }, [user, company, form]);

  const onSave = async (values: ProfileForm) => {
    setSaving(true);
    try {
      await api.patch("/auth/me", {
        firstName: values.firstName,
        lastName: values.lastName,
        bio: values.bio?.trim() || "",
        preferences: {
          timezone: values.timezone,
          dateFormat: values.dateFormat,
          timeFormat: values.timeFormat,
        },
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data } = await uploadApi.upload([await resizeImageToSquare(file)]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");

      await api.patch("/auth/me", { avatar: url });
      await refreshUser();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to update profile photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const dateFormat = form.watch("dateFormat");
  const timeFormat = form.watch("timeFormat");

  return (
    <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
      {/* Profile photo */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Profile photo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Update your avatar across Agentra</p>
        </div>
        <div className="flex items-center gap-5 p-6">
          <div className="relative">
            <Avatar className="size-20">
              {user?.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                {initials(user?.firstName, user?.lastName)}
              </AvatarFallback>
            </Avatar>
            {uploadingAvatar ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="size-5 animate-spin text-white" />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onAvatarChange(event)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4" />
              {uploadingAvatar ? "Uploading…" : "Update photo"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, or GIF. Max 5 MB.</p>
          </div>
        </div>
      </div>

      {/* Name & bio */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Profile</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Your name and bio visible to your team</p>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">First name</Label>
              <Input {...form.register("firstName")} className="focus-visible:ring-primary/30" />
              {form.formState.errors.firstName ? (
                <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Last name</Label>
              <Input {...form.register("lastName")} className="focus-visible:ring-primary/30" />
              {form.formState.errors.lastName ? (
                <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted/30 text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Bio</Label>
            <Textarea
              {...form.register("bio")}
              rows={4}
              placeholder="Tell your team a little about yourself"
              className="focus-visible:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground">{(form.watch("bio") ?? "").length}/280 characters</p>
          </div>
        </div>
      </div>

      {/* Date and time settings */}
      <div className="rounded-[10px] border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60">
          <h3 className="font-semibold text-foreground">Date and time settings</h3>
        </div>
        <div className="space-y-6 p-6">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Timezone</Label>
            <Controller
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {timezoneOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Date format</Label>
              <Controller
                control={form.control}
                name="dateFormat"
                render={({ field }) => (
                  <div className="space-y-1">
                    <RadioOption
                      name="dateFormat"
                      value="DMY"
                      checked={field.value === "DMY"}
                      label="Day/Month/Year"
                      description={`Example: ${formatDateExample("DMY")}`}
                      onChange={field.onChange}
                    />
                    <RadioOption
                      name="dateFormat"
                      value="MDY"
                      checked={field.value === "MDY"}
                      label="Month/Day/Year"
                      description={`Example: ${formatDateExample("MDY")}`}
                      onChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Time format</Label>
              <Controller
                control={form.control}
                name="timeFormat"
                render={({ field }) => (
                  <div className="space-y-1">
                    <RadioOption
                      name="timeFormat"
                      value="24h"
                      checked={field.value === "24h"}
                      label="24-hour"
                      onChange={field.onChange}
                    />
                    <RadioOption
                      name="timeFormat"
                      value="12h"
                      checked={field.value === "12h"}
                      label="AM/PM"
                      onChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>
          </div>

          <p className={cn("text-xs text-muted-foreground")}>
            Preview: {formatDateExample(dateFormat)} ·{" "}
            {new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
              hour12: timeFormat === "12h",
            }).format(new Date())}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="size-4" />
          ) : null}
          {saved ? "Saved!" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
