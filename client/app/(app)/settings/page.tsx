"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, User, Lock, Bell, Building2, Eye, EyeOff, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import HelpCenterSettings from "@/components/helpcenter/HelpCenterSettings";

const profileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName:  z.string().min(1).max(50),
  phone:     z.string().optional(),
  jobTitle:  z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string()
    .min(8, "At least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Needs upper, lower, number"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match", path: ["confirmPassword"],
});
type PasswordForm = z.infer<typeof passwordSchema>;

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const TABS = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "security",      label: "Security",      icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "workspace",     label: "Workspace",     icon: Building2, staffOnly: true },
  { id: "helpcenter",    label: "Help Center",   icon: HelpCircle, staffOnly: true },
] as const;

type TabId = typeof TABS[number]["id"];

export default function SettingsPage() {
  const { user, company, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrent,    setShowCurrent]    = useState(false);
  const [showNew,        setShowNew]        = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);

  const isStaff = ["owner", "admin"].includes(user?.role ?? "");

  // Honour ?tab=helpcenter (or any valid tab) from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabId | null;
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName:  user?.lastName  ?? "",
      phone:     "",
      jobTitle:  "",
    },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSaveProfile = async (values: ProfileForm) => {
    setSavingProfile(true);
    try {
      await api.patch("/auth/me", values);
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { toast.error("Failed to save profile"); }
    finally { setSavingProfile(false); }
  };

  const onChangePassword = async (values: PasswordForm) => {
    setSavingPassword(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
      });
      passwordForm.reset();
      toast.success("Password changed — please log in again.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed";
      toast.error(msg);
    } finally { setSavingPassword(false); }
  };

  const visibleTabs = TABS.filter((t) => !("staffOnly" in t) || (t.staffOnly && isStaff));

  return (
    <div className="max-w-3xl space-y-0">
      {/* Page header with avatar */}
      <div className="flex items-center gap-5 pb-6">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
              {initials(user?.fullName ?? user?.firstName ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary">
            <span className="text-white text-[8px] font-bold">{(user?.firstName ?? "")[0]}</span>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
          <p className="text-sm text-gray-400 capitalize">{user?.role} · {user?.email}</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-44 shrink-0 space-y-1 overflow-y-auto">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                activeTab === id
                  ? "bg-brand-muted text-[#D85A30]"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", activeTab === id ? "text-[#D85A30]" : "text-gray-400")} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── Profile ──────────────────────────────────────── */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Personal information</h3>
                <p className="text-xs text-gray-400 mt-0.5">Update your name and contact details</p>
              </div>
              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">First name</Label>
                    <Input {...profileForm.register("firstName")} className="focus-visible:ring-[#D85A30]" />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-xs text-red-500">{profileForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Last name</Label>
                    <Input {...profileForm.register("lastName")} className="focus-visible:ring-[#D85A30]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Email address</Label>
                  <Input value={user?.email} disabled className="bg-gray-50 text-gray-500" />
                  <p className="text-xs text-gray-400">Email cannot be changed here</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Phone <span className="text-gray-300">(optional)</span></Label>
                    <Input {...profileForm.register("phone")} placeholder="+1 555 000 0000" className="focus-visible:ring-[#D85A30]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Job title <span className="text-gray-300">(optional)</span></Label>
                    <Input {...profileForm.register("jobTitle")} placeholder="Support Engineer" className="focus-visible:ring-[#D85A30]" />
                  </div>
                </div>

                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">Changes saved to your account immediately</p>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile
                      ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      : profileSaved
                        ? <CheckCircle2 className="h-4 w-4 mr-2" />
                        : null}
                    {profileSaved ? "Saved!" : "Save changes"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────── */}
          {activeTab === "security" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Change password</h3>
                <p className="text-xs text-gray-400 mt-0.5">Use a strong password you don&apos;t use elsewhere</p>
              </div>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Current password</Label>
                  <div className="relative">
                    <Input type={showCurrent ? "text" : "password"} {...passwordForm.register("currentPassword")}
                      className="pr-10 focus-visible:ring-[#D85A30]" />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-xs text-red-500">{passwordForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">New password</Label>
                  <div className="relative">
                    <Input type={showNew ? "text" : "password"} {...passwordForm.register("newPassword")}
                      className="pr-10 focus-visible:ring-[#D85A30]" />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-xs text-red-500">{passwordForm.formState.errors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Confirm new password</Label>
                  <Input type="password" {...passwordForm.register("confirmPassword")}
                    className="focus-visible:ring-[#D85A30]" />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                {/* Password rules */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  {[
                    "At least 8 characters",
                    "One uppercase letter",
                    "One lowercase letter",
                    "One number",
                  ].map((rule) => (
                    <p key={rule} className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                      {rule}
                    </p>
                  ))}
                </div>

                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Update password
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* ── Notifications ────────────────────────────────── */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Notification preferences</h3>
                <p className="text-xs text-gray-400 mt-0.5">Choose how you want to hear from us</p>
              </div>
              <div className="p-6 space-y-5">
                {[
                  { label: "Email notifications",    desc: "Receive updates via email",          key: "email" },
                  { label: "Browser notifications",  desc: "Desktop push notifications",          key: "browser" },
                  { label: "New ticket assigned",    desc: "When a ticket is assigned to you",   key: "assigned" },
                  { label: "Ticket replies",         desc: "When someone replies on your ticket", key: "replies" },
                ].map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                      <p className="text-xs text-gray-400">{pref.desc}</p>
                    </div>
                    <Switch defaultChecked className="data-[state=checked]:bg-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Workspace ────────────────────────────────────── */}
          {activeTab === "workspace" && isStaff && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Workspace overview</h3>
                <p className="text-xs text-gray-400 mt-0.5">{company?.subdomain}.agentraa.com</p>
              </div>
              <div className="p-6 space-y-5">
                {/* Plan card */}
                <div className="rounded-xl p-4 border border-brand-muted bg-brand-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-primary font-medium uppercase tracking-wider">Current plan</p>
                      <p className="text-xl font-bold text-gray-900 capitalize mt-0.5">{company?.plan?.name}</p>
                    </div>
                    <span className={cn(
                      "text-xs px-3 py-1 rounded-full font-medium capitalize",
                      company?.plan?.status === "trialing" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                    )}>
                      {company?.plan?.status}
                    </span>
                  </div>
                  {company?.plan?.trialEndsAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Trial ends {new Date(company.plan.trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ["Company name",  company?.name ?? "—"],
                    ["Subdomain",     company?.subdomain ?? "—"],
                    ["Your role",     user?.role ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <Separator />
                <p className="text-xs text-gray-400 text-center">
                  To upgrade your plan or manage billing, contact{" "}
                  <a href="mailto:support@agentraa.com" className="text-[#D85A30] hover:underline">
                    support@agentraa.com
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* ── Help Center ──────────────────────────────────── */}
          {activeTab === "helpcenter" && isStaff && (
            <HelpCenterSettings />
          )}

        </div>
      </div>
    </div>
  );
}
