"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ImagePlus, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { liveChatApi, uploadApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { LiveChatAgent, LiveChatSettings, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import LiveChatWidgetPreview from "@/components/settings/live-chat-widget-preview";
import KnowledgeArticlesSection from "@/components/settings/knowledge-articles-section";
import UserPicker from "@/components/shared/UserPicker";
import { resizeLogoFile } from "@/lib/workspace-branding";

const AGENT_COLORS = ["#a78bfa", "#f97316", "#22c55e", "#3b82f6", "#ec4899"];

function namePart(value?: string) {
  const v = (value || "").trim();
  return !v || v === "-" ? "" : v;
}

function userToLiveChatAgent(user: User, index: number): LiveChatAgent {
  const firstName = namePart(user.firstName) || user.firstName;
  const lastName = namePart(user.lastName);
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    (user.fullName || "").trim().replace(/\s+-\s*$/, "") ||
    user.email ||
    "Agent";
  const initials =
    `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase() ||
    fullName.slice(0, 2).toUpperCase() ||
    "A";
  return {
    _id: user._id,
    firstName,
    lastName,
    fullName,
    avatar: user.avatar,
    role: user.role,
    isOnline: user.isOnline,
    initials,
    color: AGENT_COLORS[index % AGENT_COLORS.length],
  };
}

const WIDGET_FONTS = [
  "Plus Jakarta Sans",
  "Inter",
  "DM Sans",
  "Outfit",
  "Manrope",
  "Sora",
  "Nunito Sans",
  "Poppins",
  "Rubik",
  "Work Sans",
] as const;

function loadGoogleFont(family: string) {
  const name = family.replace(/['"]/g, "").split(",")[0].trim();
  if (!name || typeof document === "undefined") return;
  const id = `agentra-settings-gf-${name.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(
    /%20/g,
    "+",
  )}:wght@400..800&display=swap`;
  document.head.appendChild(link);
}

type TabId = "general" | "appearance" | "ai" | "knowledge" | "install";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI & actions" },
  { id: "knowledge", label: "Knowledge" },
  { id: "install", label: "Install" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function LiveChatSettingsPanel() {
  const [tab, setTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [settings, setSettings] = useState<LiveChatSettings | null>(null);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: settingsRes } = await liveChatApi.getSettings();
      setSettings(settingsRes.data.liveChat);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load live chat settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!settings?.appearance?.fontFamily) return;
    loadGoogleFont(settings.appearance.fontFamily);
  }, [settings?.appearance?.fontFamily]);

  const uploadLogo = async (file: File) => {
    if (!settings) return;
    setUploadingLogo(true);
    try {
      const resized = await resizeLogoFile(file, 480, 160);
      const { data } = await uploadApi.upload([resized]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      setSettings({
        ...settings,
        appearance: { ...settings.appearance, logoUrl: url },
      });
      toast.success("Logo uploaded");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to upload logo");
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadFavicon = async (file: File) => {
    if (!settings) return;
    setUploadingFavicon(true);
    try {
      const resized = await resizeLogoFile(file, 128, 128);
      const { data } = await uploadApi.upload([resized]);
      const url = data.data.attachments?.[0]?.url as string | undefined;
      if (!url) throw new Error("Upload failed");
      setSettings({
        ...settings,
        appearance: { ...settings.appearance, faviconUrl: url },
      });
      toast.success("Favicon uploaded");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to upload favicon");
      toast.error(message);
    } finally {
      setUploadingFavicon(false);
    }
  };

  const save = async (extra: Record<string, unknown> = {}) => {
    if (!settings) return;
    setSaving(true);
    try {
      const quickReplies = (settings.content.quickReplies ?? [])
        .slice(0, 4)
        .map((s) => String(s || "").trim())
        .filter(Boolean);
      const { data } = await liveChatApi.updateSettings({
        enabled: settings.enabled,
        appearance: settings.appearance,
        content: { ...settings.content, quickReplies },
        behavior: settings.behavior,
        ai: settings.ai,
        agents: (settings.agents ?? []).map((a) => a._id),
        ...extra,
      });
      setSettings(data.data.liveChat);
      toast.success("Live chat settings saved");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to save settings");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Live chat</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Configure your storefront chat widget, AI assistant, and knowledge base.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,22rem)] lg:items-start xl:grid-cols-[minmax(0,32rem)_minmax(0,24rem)]">
          <div className="min-w-0 space-y-5">
          {settings.lastError ? (
            <p className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-800">
              {settings.lastError}
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-semibold">Enable live chat widget</p>
              <p className="text-xs text-muted-foreground">
                {settings.canAutoInstall
                  ? "Installs on your Shopify storefront when saved"
                  : "Show the chat bubble after the widget is installed on your store"}
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>

          {settings.canAutoInstall && settings.widgetInstalled ? (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={async () => {
                try {
                  const { data } = await liveChatApi.uninstallWidget();
                  setSettings(data.data.liveChat);
                  toast.success("Widget removed from your store");
                } catch (err: unknown) {
                  const { message } = getApiError(err, "Failed to remove widget");
                  toast.error(message);
                }
              }}
            >
              Remove from Shopify store
            </Button>
          ) : null}

          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Live chat agents</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Staff who can handle live chat in the portal. Their faces show on the
                  home “Leave us a message” card (up to 5).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || (settings.agents?.length ?? 0) >= 8}
                onClick={() => setAgentPickerOpen(true)}
              >
                <Plus className="mr-1.5 size-3.5" />
                Add
              </Button>
            </div>
            {(settings.agents?.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                No agents selected yet. Add staff so they appear on the widget and can be
                assigned conversations.
              </p>
            ) : (
              <ul className="space-y-2">
                {(settings.agents ?? []).map((agent, index) => (
                  <li
                    key={agent._id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-2"
                  >
                    <Avatar className="size-9 shrink-0">
                      {agent.avatar ? <AvatarImage src={agent.avatar} alt={agent.fullName} /> : null}
                      <AvatarFallback
                        className="text-xs font-semibold text-white"
                        style={{ background: agent.color || AGENT_COLORS[index % AGENT_COLORS.length] }}
                      >
                        {agent.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{agent.fullName}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {agent.role || "agent"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${agent.fullName}`}
                      disabled={saving}
                      onClick={() =>
                        setSettings({
                          ...settings,
                          agents: (settings.agents ?? []).filter((a) => a._id !== agent._id),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick replies (home screen)</Label>
            {[0, 1, 2, 3].map((index) => {
              const replies = settings.content.quickReplies ?? [];
              return (
                <Field key={index} label={`Quick Reply ${index + 1}:`}>
                  <Input
                    value={replies[index] ?? ""}
                    placeholder={`e.g. ${
                      [
                        "Where is my order?",
                        "Return or refund policy",
                        "Talk to a human",
                        "Product recommendations",
                      ][index]
                    }`}
                    onChange={(e) => {
                      const next = [...(settings.content.quickReplies ?? [])];
                      while (next.length < 4) next.push("");
                      next[index] = e.target.value;
                      setSettings({
                        ...settings,
                        content: { ...settings.content, quickReplies: next },
                      });
                    }}
                  />
                </Field>
              );
            })}
          </div>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save general settings
          </Button>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-4">
            <LiveChatWidgetPreview settings={settings} />
          </aside>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,22rem)] lg:items-start xl:grid-cols-[minmax(0,32rem)_minmax(0,24rem)]">
          <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary color" hint="Header, buttons, launcher">
              <Input
                type="color"
                value={settings.appearance.brandColor}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, brandColor: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Background color" hint="Panel and card surface">
              <Input
                type="color"
                value={settings.appearance.backgroundColor || "#ffffff"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appearance: { ...settings.appearance, backgroundColor: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <Field label="Font" hint="Loaded from Google Fonts for preview and the live widget">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={
                WIDGET_FONTS.includes(
                  settings.appearance.fontFamily as (typeof WIDGET_FONTS)[number],
                )
                  ? settings.appearance.fontFamily
                  : WIDGET_FONTS[0]
              }
              style={{
                fontFamily: `'${settings.appearance.fontFamily || "Plus Jakarta Sans"}', system-ui, sans-serif`,
              }}
              onChange={(e) => {
                loadGoogleFont(e.target.value);
                setSettings({
                  ...settings,
                  appearance: { ...settings.appearance, fontFamily: e.target.value },
                });
              }}
            >
              {WIDGET_FONTS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: `'${font}', system-ui, sans-serif` }}>
                  {font}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium">Logo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload PNG, JPG, WebP, or SVG. Set width and height in pixels for the header.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex h-16 min-w-[140px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4"
                style={{ backgroundColor: settings.appearance.backgroundColor || "#fff" }}
              >
                {settings.appearance.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.appearance.logoUrl}
                    alt="Logo preview"
                    className="object-contain"
                    style={{
                      maxWidth: settings.appearance.logoWidth || 120,
                      maxHeight: settings.appearance.logoHeight || 40,
                      width: "auto",
                      height: "auto",
                    }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingLogo || saving}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 size-4" />
                )}
                Upload logo
              </Button>
              {settings.appearance.logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      appearance: { ...settings.appearance, logoUrl: "" },
                    })
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Width (px)">
                <Input
                  type="number"
                  min={24}
                  max={280}
                  value={settings.appearance.logoWidth ?? 120}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      appearance: {
                        ...settings.appearance,
                        logoWidth: Math.min(280, Math.max(24, Number(e.target.value) || 120)),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Height (px)">
                <Input
                  type="number"
                  min={16}
                  max={120}
                  value={settings.appearance.logoHeight ?? 40}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      appearance: {
                        ...settings.appearance,
                        logoHeight: Math.min(120, Math.max(16, Number(e.target.value) || 40)),
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium">Favicon</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Square image shown in the chat header circle (and typing indicator) when a
                conversation starts. PNG, JPG, WebP, or SVG.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-dashed border-border/80 bg-muted/20"
                style={{ backgroundColor: settings.appearance.brandColor || "#2563eb" }}
              >
                {settings.appearance.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.appearance.faviconUrl}
                    alt="Favicon preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-white">
                    {(settings.content.agentName || "S").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFavicon(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingFavicon || saving}
                onClick={() => faviconInputRef.current?.click()}
              >
                {uploadingFavicon ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 size-4" />
                )}
                Upload favicon
              </Button>
              {settings.appearance.faviconUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      appearance: { ...settings.appearance, faviconUrl: "" },
                    })
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <Field
            label="Welcome title"
            hint="Use a new line for a second title line (like the reference chat home)."
          >
            <Textarea
              rows={2}
              value={settings.content.welcomeTitle ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, welcomeTitle: e.target.value },
                })
              }
              placeholder={"Hi there 👋\nHow can we help?"}
            />
          </Field>
          <Field label="Description" hint="Shown under the title on the home screen">
            <Textarea
              rows={2}
              value={settings.content.welcomeSubtitle ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, welcomeSubtitle: e.target.value },
                })
              }
              placeholder="Ask about orders, products, returns & store support."
            />
          </Field>
          <Field
            label="Store display name"
            hint="Shown on the “Leave us a message” card and in the home header when no logo is set."
          >
            <Input
              value={settings.content.storeDisplayName ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, storeDisplayName: e.target.value },
                })
              }
              placeholder="Your store name"
            />
          </Field>
          <Field label="Agent display name">
            <Input
              value={settings.content.agentName ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, agentName: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Email gate title">
            <Input
              value={settings.content.emailGateTitle ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, emailGateTitle: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Email gate subtitle">
            <Textarea
              rows={2}
              value={settings.content.emailGateSubtitle ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, emailGateSubtitle: e.target.value },
                })
              }
            />
          </Field>
          <Field
            label="Privacy notice"
            hint="Shown on the email gate and at the top of chat. Keep this short and clear."
          >
            <Textarea
              rows={3}
              value={
                settings.content.privacyNotice ??
                "This chat is AI-powered for faster assistance. Chats are monitored and recorded."
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  content: { ...settings.content, privacyNotice: e.target.value },
                })
              }
              placeholder="This chat is AI-powered for faster assistance. Chats are monitored and recorded."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Privacy policy label" hint="Link text next to the notice">
              <Input
                value={settings.content.privacyPolicyLabel ?? "Privacy Policy"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    content: { ...settings.content, privacyPolicyLabel: e.target.value },
                  })
                }
                placeholder="Privacy Policy"
              />
            </Field>
            <Field label="Privacy policy URL" hint="Your store’s privacy policy page">
              <Input
                type="url"
                value={settings.content.privacyPolicyUrl ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    content: { ...settings.content, privacyPolicyUrl: e.target.value },
                  })
                }
                placeholder="https://yourstore.com/policies/privacy-policy"
              />
            </Field>
          </div>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save appearance
          </Button>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-4">
            <LiveChatWidgetPreview settings={settings} />
          </aside>
        </div>
      ) : null}

      {tab === "ai" ? (
        <div className="max-w-xl space-y-4">
          <Field label="Custom AI instructions" hint="What the bot should and should not do for your store.">
            <Textarea
              rows={6}
              value={settings.ai.instructions ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, ai: { ...settings.ai, instructions: e.target.value } })
              }
              placeholder="Example: Never offer discounts above 10%. Always ask for order number before sharing tracking."
            />
          </Field>
          <Field label="Max auto-refund amount (USD)">
            <Input
              type="number"
              min={0}
              value={settings.ai.allowedActions.maxRefundAmount ?? 100}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: {
                    ...settings.ai,
                    allowedActions: {
                      ...settings.ai.allowedActions,
                      maxRefundAmount: Number(e.target.value),
                    },
                  },
                })
              }
            />
          </Field>
          {(
            [
              ["lookupOrder", "Look up orders (verified)"],
              ["refundOrder", "Auto-refund within limit"],
              ["cancelOrder", "Cancel orders"],
              ["editOrder", "Edit order contact/address"],
              ["productRecommendations", "Product recommendations"],
              ["requestHuman", "Offer human handoff"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <span className="text-sm">{label}</span>
              <Switch
                checked={Boolean(settings.ai.allowedActions[key])}
                onCheckedChange={(v) =>
                  setSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      allowedActions: { ...settings.ai.allowedActions, [key]: v },
                    },
                  })
                }
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save AI settings
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const { data } = await liveChatApi.syncProducts();
                  toast.success(`Synced ${data.data.synced ?? 0} products`);
                } catch (err: unknown) {
                  const { message } = getApiError(err, "Product sync failed");
                  toast.error(message);
                }
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              Sync product catalog
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "knowledge" ? (
        <div className="max-w-2xl">
          <KnowledgeArticlesSection description="Shared with Workspace › AI Agent. Changes in either place update the same documents." />
        </div>
      ) : null}

      {tab === "install" ? (
        <div className="max-w-2xl space-y-4">
          {settings.canAutoInstall ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">Shopify</p>
              <p className="mt-1 text-muted-foreground">
                Enable live chat on the General tab to install the widget on your storefront.
              </p>
              <Button
                className="mt-3"
                disabled={!settings.enabled && !settings.widgetKey}
                onClick={async () => {
                  try {
                    const { data } = await liveChatApi.installWidget();
                    setSettings(data.data.liveChat);
                    toast.success("Widget installed on your store");
                  } catch (err: unknown) {
                    const { message } = getApiError(err, "Install failed");
                    toast.error(message);
                  }
                }}
              >
                Install on store now
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              Paste this snippet before the closing <code>&lt;/body&gt;</code> tag on your storefront.
            </div>
          )}
          <Field label="Widget key">
            <div className="flex gap-2">
              <Input readOnly value={settings.widgetKey ?? ""} />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const { data } = await liveChatApi.regenerateWidgetKey();
                    setSettings(data.data.liveChat);
                    toast.success("Widget key regenerated");
                  } catch (err: unknown) {
                    const { message } = getApiError(err, "Failed to regenerate key");
                    toast.error(message);
                  }
                }}
              >
                Regenerate
              </Button>
            </div>
          </Field>
          <Field label="Embed code" hint="Paste before </body> on your storefront.">
            <Textarea rows={8} readOnly value={settings.embedSnippet ?? ""} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => {
                if (settings.embedSnippet) {
                  void navigator.clipboard.writeText(settings.embedSnippet);
                  toast.success("Embed code copied");
                }
              }}
            >
              <Copy className="mr-2 size-4" />
              Copy embed code
            </Button>
          </Field>
          <Button disabled={saving || !settings.enabled} onClick={() => void save({ enabled: true })}>
            Enable & save
          </Button>
        </div>
      ) : null}

      <UserPicker
        open={agentPickerOpen}
        onOpenChange={setAgentPickerOpen}
        title="Add live chat agents"
        scope="staff"
        multi
        confirmLabel="Add agents"
        excludeIds={(settings.agents ?? []).map((a) => a._id)}
        onSelect={(user) => {
          setSettings((prev) => {
            if (!prev) return prev;
            if ((prev.agents ?? []).some((a) => a._id === user._id)) return prev;
            const next = [...(prev.agents ?? []), userToLiveChatAgent(user, prev.agents?.length ?? 0)];
            return { ...prev, agents: next.slice(0, 8) };
          });
        }}
      />
    </div>
  );
}
