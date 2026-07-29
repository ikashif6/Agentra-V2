"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import KnowledgeArticlesSection from "@/components/settings/knowledge-articles-section";
import { aiAgentApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

type ChannelKey = "liveChat" | "email" | "facebook" | "instagram" | "whatsapp" | "tiktok";

type AllowedActions = {
  lookupOrder?: boolean;
  cancelOrder?: boolean;
  refundOrder?: boolean;
  maxRefundAmount?: number;
  editOrder?: boolean;
  productRecommendations?: boolean;
  requestHuman?: boolean;
};

type ChannelOverride = {
  instructions?: string;
  escalationKeywords?: string[];
  allowedActions?: AllowedActions;
} | null;

type AiAgentDefaults = {
  instructions: string;
  escalationKeywords: string[];
  allowedActions: AllowedActions;
};

type AiAgentSettings = {
  enabledChannels: Record<ChannelKey, boolean>;
  defaults: AiAgentDefaults;
  channelOverrides: Record<ChannelKey, ChannelOverride>;
  instructionPlaceholders?: Record<ChannelKey, string>;
  liveChatAiEnabled: boolean;
  agentName?: string;
};

const CHANNEL_OPTIONS: {
  key: ChannelKey;
  label: string;
  description: string;
  requires?: string;
}[] = [
  {
    key: "liveChat",
    label: "Live chat",
    description:
      "When on, AI answers website widget chats when it can, and hands off when it cannot.",
    requires: "Enable the widget under Channels › Live chat.",
  },
  {
    key: "email",
    label: "Email",
    description:
      "When on, AI auto-replies to inbound support email when it can; otherwise the ticket waits in the inbox.",
    requires: "Connect a mailbox under Channels › Email.",
  },
  {
    key: "facebook",
    label: "Facebook Messenger",
    description:
      "When on, AI auto-replies to Facebook Page DMs when it can; otherwise conversations wait in the inbox.",
    requires: "Connect Facebook under Channels › Facebook.",
  },
  {
    key: "instagram",
    label: "Instagram",
    description:
      "When on, AI auto-replies to Instagram DMs when it can; otherwise conversations wait in the inbox.",
    requires: "Connect Instagram under Channels › Instagram.",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description:
      "When on, AI auto-replies to WhatsApp messages when it can; otherwise conversations wait in the inbox.",
    requires: "Connect WhatsApp under Channels › WhatsApp.",
  },
];

const ACTION_TOGGLES = [
  ["lookupOrder", "Look up orders"],
  ["refundOrder", "Auto-refund within limit"],
  ["cancelOrder", "Cancel orders"],
  ["editOrder", "Edit order contact/address"],
  ["productRecommendations", "Product recommendations"],
  ["requestHuman", "Offer human handoff"],
] as const;

const EMPTY_OVERRIDES: Record<ChannelKey, ChannelOverride> = {
  liveChat: null,
  email: null,
  facebook: null,
  instagram: null,
  whatsapp: null,
  tiktok: null,
};

type TabId = "defaults" | "channels" | "knowledge";

const TABS: { id: TabId; label: string }[] = [
  { id: "defaults", label: "Defaults" },
  { id: "channels", label: "Channels" },
  { id: "knowledge", label: "Knowledge" },
];

const DEFAULT_SETTINGS: AiAgentSettings = {
  enabledChannels: {
    liveChat: true,
    email: false,
    facebook: false,
    instagram: false,
    whatsapp: false,
    tiktok: false,
  },
  defaults: {
    instructions: "",
    escalationKeywords: [],
    allowedActions: {
      lookupOrder: true,
      cancelOrder: false,
      refundOrder: true,
      maxRefundAmount: 100,
      editOrder: false,
      productRecommendations: true,
      requestHuman: true,
    },
  },
  channelOverrides: { ...EMPTY_OVERRIDES },
  liveChatAiEnabled: true,
};

function normalizeSettings(raw: Partial<AiAgentSettings> & Record<string, unknown>): AiAgentSettings {
  const defaultsRaw =
    (raw.defaults as AiAgentDefaults | undefined) ||
    ({
      instructions: (raw.instructions as string) || "",
      escalationKeywords: (raw.escalationKeywords as string[]) || [],
      allowedActions: (raw.allowedActions as AllowedActions) || DEFAULT_SETTINGS.defaults.allowedActions,
    } satisfies AiAgentDefaults);

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    enabledChannels: {
      ...DEFAULT_SETTINGS.enabledChannels,
      ...(raw.enabledChannels || {}),
    },
    defaults: {
      ...DEFAULT_SETTINGS.defaults,
      ...defaultsRaw,
      allowedActions: {
        ...DEFAULT_SETTINGS.defaults.allowedActions,
        ...(defaultsRaw.allowedActions || {}),
      },
    },
    channelOverrides: {
      ...EMPTY_OVERRIDES,
      ...(raw.channelOverrides || {}),
    },
    instructionPlaceholders: (raw.instructionPlaceholders as Record<ChannelKey, string>) || undefined,
  };
}

function hasChannelCustomization(override: ChannelOverride) {
  if (!override) return false;
  if (override.instructions !== undefined) return true;
  if (Array.isArray(override.escalationKeywords)) return true;
  if (override.allowedActions && Object.keys(override.allowedActions).length) return true;
  return false;
}

function effectiveActions(defaults: AllowedActions, override: ChannelOverride): AllowedActions {
  return {
    ...defaults,
    ...(override?.allowedActions || {}),
  };
}

export default function AiAgentSettingsPanel() {
  const [tab, setTab] = useState<TabId>("defaults");
  const [settings, setSettings] = useState<AiAgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<ChannelKey | null>(null);
  const [draftInstructions, setDraftInstructions] = useState<Record<ChannelKey, string>>({
    liveChat: "",
    email: "",
    facebook: "",
    instagram: "",
    whatsapp: "",
    tiktok: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiAgentApi.getSettings();
      const next = normalizeSettings(data.data.aiAgent as Partial<AiAgentSettings>);
      setSettings(next);
      setDraftInstructions(
        Object.fromEntries(
          CHANNEL_OPTIONS.map(({ key }) => [
            key,
            next.channelOverrides[key]?.instructions ?? "",
          ]),
        ) as Record<ChannelKey, string>,
      );
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load AI Agent settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (patch: Record<string, unknown>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await aiAgentApi.updateSettings(patch);
      const next = normalizeSettings(data.data.aiAgent as Partial<AiAgentSettings>);
      setSettings(next);
      setDraftInstructions(
        Object.fromEntries(
          CHANNEL_OPTIONS.map(({ key }) => [
            key,
            next.channelOverrides[key]?.instructions ?? "",
          ]),
        ) as Record<ChannelKey, string>,
      );
      toast.success("AI Agent settings saved");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not save AI Agent settings");
      toast.error(message);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (key: ChannelKey, enabled: boolean) => {
    if (!settings) return;
    const enabledChannels = { ...settings.enabledChannels, [key]: enabled };
    setSettings({ ...settings, enabledChannels });
    void persist({ enabledChannels });
    if (enabled) {
      setExpanded(key);
      if (key !== "liveChat") {
        toast.message("AI will auto-reply on this channel when it can", {
          description:
            "Connect the channel under Channels settings if you have not already. Unassign tickets for AI to answer; assigned chats stay with your team.",
        });
      }
    }
  };

  const saveDefaults = async () => {
    if (!settings) return;
    await persist({
      defaults: {
        instructions: settings.defaults.instructions,
        allowedActions: settings.defaults.allowedActions,
      },
    });
  };

  const saveChannelInstructions = async (key: ChannelKey) => {
    if (!settings) return;
    const value = draftInstructions[key] ?? "";
    const hadOverride = settings.channelOverrides[key]?.instructions !== undefined;
    const previous = settings.channelOverrides[key]?.instructions ?? "";
    if (!hadOverride && value === "") return;
    if (hadOverride && value === previous) return;
    await persist({
      channelOverrides: {
        [key]: {
          instructions: value,
        },
      },
    });
  };

  const clearChannelInstructions = async (key: ChannelKey) => {
    setDraftInstructions((prev) => ({ ...prev, [key]: "" }));
    await persist({
      channelOverrides: {
        [key]: { instructions: null },
      },
    });
  };

  const setChannelAction = async (
    key: ChannelKey,
    actionKey: keyof AllowedActions,
    value: boolean | number,
  ) => {
    if (!settings) return;
    const defaultsValue = settings.defaults.allowedActions[actionKey];
    // If setting back to default, clear that override key
    const nextValue = value === defaultsValue ? null : value;
    await persist({
      channelOverrides: {
        [key]: {
          allowedActions: { [actionKey]: nextValue },
        },
      },
    });
  };

  const resetChannelActions = async (key: ChannelKey) => {
    await persist({
      channelOverrides: {
        [key]: { allowedActions: null },
      },
    });
  };

  const clearChannelAll = async (key: ChannelKey) => {
    setDraftInstructions((prev) => ({ ...prev, [key]: "" }));
    await persist({
      channelOverrides: { [key]: null },
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" />
          Multi-channel AI
        </div>
        <h2 className="text-xl font-bold text-foreground">AI Agent</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Shared knowledge across channels. Tune tone, length, and permissions per channel — email can
          stay long and formal while social stays short.
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

      {tab === "defaults" ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-sm font-medium text-foreground">Shared defaults</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Used on every channel unless you add a channel override under Channels.
            </p>
          </div>
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="ai-default-instructions">Default instructions</Label>
              <Textarea
                id="ai-default-instructions"
                rows={4}
                value={settings.defaults.instructions}
                disabled={saving}
                placeholder="Brand voice, policies, and must/must-not rules for all channels."
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          defaults: { ...prev.defaults, instructions: e.target.value },
                        }
                      : prev,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-max-refund">Max auto-refund amount (USD)</Label>
              <Input
                id="ai-max-refund"
                type="number"
                min={0}
                disabled={saving}
                value={settings.defaults.allowedActions.maxRefundAmount ?? 100}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          defaults: {
                            ...prev.defaults,
                            allowedActions: {
                              ...prev.defaults.allowedActions,
                              maxRefundAmount: Number(e.target.value),
                            },
                          },
                        }
                      : prev,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              {ACTION_TOGGLES.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={Boolean(settings.defaults.allowedActions[key])}
                    disabled={saving}
                    onCheckedChange={(v) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              defaults: {
                                ...prev.defaults,
                                allowedActions: {
                                  ...prev.defaults.allowedActions,
                                  [key]: v,
                                },
                              },
                            }
                          : prev,
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <Button disabled={saving} onClick={() => void saveDefaults()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save defaults
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "channels" ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-sm font-medium text-foreground">Deploy on channels</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn AI on per channel. When on, the agent auto-replies when it knows the answer
              (policies, order status after verifying identity, products) and hands off to your
              team when it does not. Expand a channel to override instructions and permissions.
              Built-in style guidance still applies (e.g. longer email, shorter Instagram).
            </p>
          </div>
          <ul className="divide-y divide-border/60">
            {CHANNEL_OPTIONS.map((channel) => {
              const on = Boolean(settings.enabledChannels[channel.key]);
              const isOpen = expanded === channel.key;
              const override = settings.channelOverrides[channel.key];
              const customized = hasChannelCustomization(override);
              const actions = effectiveActions(settings.defaults.allowedActions, override);
              const placeholder =
                settings.instructionPlaceholders?.[channel.key] ||
                "Optional. Leave blank to use shared defaults.";

              return (
                <li key={channel.key}>
                  <div className="flex items-start justify-between gap-4 px-5 py-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpanded(isOpen ? null : channel.key)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{channel.label}</p>
                        {customized ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Customized
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{channel.description}</p>
                      {channel.requires ? (
                        <p className="mt-1 text-[11px] text-muted-foreground/80">{channel.requires}</p>
                      ) : null}
                    </button>
                    <Switch
                      checked={on}
                      disabled={saving}
                      onCheckedChange={(checked) => toggleChannel(channel.key, checked)}
                      aria-label={`Enable AI on ${channel.label}`}
                    />
                  </div>

                  {isOpen ? (
                    <div className="space-y-4 border-t border-border/50 bg-muted/20 px-5 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`ai-instructions-${channel.key}`}>
                            {channel.label} instructions
                          </Label>
                          {override?.instructions !== undefined ? (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                              disabled={saving}
                              onClick={() => void clearChannelInstructions(channel.key)}
                            >
                              Use defaults
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Inheriting defaults</span>
                          )}
                        </div>
                        <Textarea
                          id={`ai-instructions-${channel.key}`}
                          rows={4}
                          disabled={saving}
                          value={draftInstructions[channel.key]}
                          placeholder={placeholder}
                          onChange={(e) =>
                            setDraftInstructions((prev) => ({
                              ...prev,
                              [channel.key]: e.target.value,
                            }))
                          }
                          onBlur={() => void saveChannelInstructions(channel.key)}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Allowed actions</p>
                          {override?.allowedActions && Object.keys(override.allowedActions).length ? (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                              disabled={saving}
                              onClick={() => void resetChannelActions(channel.key)}
                            >
                              Reset actions
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                            <span className="text-sm">Max refund (USD)</span>
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-24"
                              disabled={saving}
                              value={actions.maxRefundAmount ?? 100}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setSettings((prev) => {
                                  if (!prev) return prev;
                                  const prevOverride = prev.channelOverrides[channel.key] || {};
                                  return {
                                    ...prev,
                                    channelOverrides: {
                                      ...prev.channelOverrides,
                                      [channel.key]: {
                                        ...prevOverride,
                                        allowedActions: {
                                          ...(prevOverride.allowedActions || {}),
                                          maxRefundAmount: n,
                                        },
                                      },
                                    },
                                  };
                                });
                              }}
                              onBlur={() =>
                                void setChannelAction(
                                  channel.key,
                                  "maxRefundAmount",
                                  Number(actions.maxRefundAmount ?? 100),
                                )
                              }
                            />
                          </div>
                          {ACTION_TOGGLES.map(([actionKey, label]) => {
                            const overridden =
                              override?.allowedActions?.[actionKey] !== undefined &&
                              override?.allowedActions?.[actionKey] !== null;
                            return (
                              <div
                                key={actionKey}
                                className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2"
                              >
                                <div>
                                  <span className="text-sm">{label}</span>
                                  {overridden ? (
                                    <span className="ml-2 text-[10px] text-muted-foreground">override</span>
                                  ) : null}
                                </div>
                                <Switch
                                  checked={Boolean(actions[actionKey])}
                                  disabled={saving}
                                  onCheckedChange={(v) => void setChannelAction(channel.key, actionKey, v)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {customized ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() => void clearChannelAll(channel.key)}
                        >
                          Clear all {channel.label} overrides
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tab === "knowledge" ? (
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-sm font-medium text-foreground">Knowledge articles</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared with{" "}
              <Link href="/settings?item=chat" className="underline underline-offset-2">
                Channels › Live chat
              </Link>
              . Changes in either place update the same documents.
            </p>
          </div>
          <div className="px-5 py-5">
            <KnowledgeArticlesSection description="" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
