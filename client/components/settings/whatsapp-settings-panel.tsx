"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  MessagesSquare,
  Phone,
  Reply,
  ShieldCheck,
  Ticket,
  Unplug,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whatsappChannelApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type {
  WhatsAppChannelIntegration,
  WhatsAppEmbeddedSignupConfig,
} from "@/lib/types";
import { ChannelBrandIcon } from "@/components/onboarding/channel-brand-icons";
import SettingsPanelShell from "./settings-panel-shell";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

const DEFAULT_WHATSAPP: WhatsAppChannelIntegration = {
  status: "disconnected",
};

const CAPABILITIES = [
  {
    icon: Ticket,
    title: "Auto-created tickets",
    description: "Every new WhatsApp chat opens a ticket in your inbox.",
  },
  {
    icon: Reply,
    title: "Reply from Agentra",
    description: "Reply from the shared inbox, and messages are delivered on WhatsApp.",
  },
  {
    icon: UserRound,
    title: "Customer context",
    description: "The sender's name and number are captured automatically.",
  },
] as const;

const HOW_IT_WORKS = [
  "Sign in with Facebook and pick your WhatsApp Business account",
  "Choose the phone number you use for support",
  "Incoming WhatsApp messages start landing in your inbox",
] as const;

const FB_SDK_ID = "facebook-jssdk";

function formatConnectedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function WhatsAppSettingsPanel() {
  const [whatsapp, setWhatsapp] = useState<WhatsAppChannelIntegration>(DEFAULT_WHATSAPP);
  const [configured, setConfigured] = useState(true);
  const [config, setConfig] = useState<WhatsAppEmbeddedSignupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [manualConnecting, setManualConnecting] = useState(false);
  const [manualAccessToken, setManualAccessToken] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState("");

  // Session info streamed from the Embedded Signup popup (waba_id + phone_number_id).
  const sessionRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: statusData }, { data: configData }] = await Promise.all([
        whatsappChannelApi.getStatus(),
        whatsappChannelApi.getConfig(),
      ]);
      setWhatsapp(statusData.data.whatsapp ?? DEFAULT_WHATSAPP);
      setConfigured(Boolean(statusData.data.configured));
      setConfig(configData.data.config ?? null);
    } catch (err: unknown) {
      const { message } = getApiError(err, "Failed to load WhatsApp settings");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Load the Facebook JS SDK once we know the app id.
  useEffect(() => {
    if (!config?.appId) return;

    const init = () => {
      if (!window.FB) return;
      window.FB.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: config.graphVersion || "v21.0",
      });
      setSdkReady(true);
    };

    if (window.FB) {
      init();
      return;
    }

    window.fbAsyncInit = init;

    if (!document.getElementById(FB_SDK_ID)) {
      const script = document.createElement("script");
      script.id = FB_SDK_ID;
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, [config?.appId, config?.graphVersion]);

  // Capture waba_id / phone_number_id emitted by the Embedded Signup flow.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
          sessionRef.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        }
      } catch {
        /* ignore non-JSON postMessage noise */
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const finishConnect = useCallback(
    async (code: string) => {
      const { wabaId, phoneNumberId } = sessionRef.current;
      if (!wabaId || !phoneNumberId) {
        toast.error("WhatsApp signup was not completed. Please try again.");
        setConnecting(false);
        return;
      }
      try {
        const { data } = await whatsappChannelApi.connect({ code, wabaId, phoneNumberId });
        setWhatsapp(data.data.whatsapp ?? DEFAULT_WHATSAPP);
        toast.success("WhatsApp connected");
      } catch (err: unknown) {
        const { message } = getApiError(err, "Could not connect WhatsApp");
        toast.error(message);
      } finally {
        sessionRef.current = {};
        setConnecting(false);
      }
    },
    [],
  );

  const startConnect = useCallback(() => {
    if (!config?.configId) {
      toast.error(
        "WhatsApp Embedded Signup isn’t configured. Add META_WA_CONFIG_ID to the server environment, then restart.",
      );
      return;
    }
    if (!window.FB || !sdkReady) {
      toast.error("WhatsApp signup isn't ready yet. Please wait a moment and retry.");
      return;
    }
    setConnecting(true);
    sessionRef.current = {};

    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (code) {
          void finishConnect(code);
        } else {
          setConnecting(false);
        }
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }, [config?.configId, finishConnect, sdkReady]);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { data } = await whatsappChannelApi.disconnect();
      setWhatsapp(data.data.whatsapp ?? DEFAULT_WHATSAPP);
      toast.success("WhatsApp disconnected");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not disconnect WhatsApp");
      toast.error(message);
    } finally {
      setDisconnecting(false);
    }
  };

  const connectManual = async () => {
    const accessToken = manualAccessToken.trim();
    const wabaId = manualWabaId.trim();
    const phoneNumberId = manualPhoneNumberId.trim();
    if (!accessToken || !wabaId || !phoneNumberId) {
      toast.error("Paste the access token, WABA ID, and phone number ID from Meta.");
      return;
    }
    setManualConnecting(true);
    try {
      const { data } = await whatsappChannelApi.connectManual({
        accessToken,
        wabaId,
        phoneNumberId,
      });
      setWhatsapp(data.data.whatsapp ?? DEFAULT_WHATSAPP);
      setManualAccessToken("");
      toast.success("WhatsApp connected (test number)");
    } catch (err: unknown) {
      const { message } = getApiError(err, "Could not connect WhatsApp");
      toast.error(message);
    } finally {
      setManualConnecting(false);
    }
  };

  if (loading) {
    return (
      <SettingsPanelShell title="WhatsApp" description="Business messaging inbox">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </SettingsPanelShell>
    );
  }

  if (!configured) {
    return (
      <SettingsPanelShell title="WhatsApp" description="Business messaging inbox">
        <div className="mx-auto max-w-lg space-y-4 text-sm text-muted-foreground">
          <p>To enable WhatsApp, add a Meta app and Embedded Signup configuration to your server environment:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code className="text-foreground">META_APP_ID</code></li>
            <li><code className="text-foreground">META_APP_SECRET</code></li>
            <li><code className="text-foreground">META_WEBHOOK_VERIFY_TOKEN</code></li>
            <li><code className="text-foreground">META_WA_CONFIG_ID</code> (Embedded Signup configuration)</li>
          </ul>
          <p>
            In{" "}
            <a
              href="https://developers.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Meta for Developers
              <ExternalLink className="size-3.5" />
            </a>
            , add the <strong className="text-foreground">WhatsApp</strong> product, then create an
            Embedded Signup configuration and copy its configuration ID.
          </p>
        </div>
      </SettingsPanelShell>
    );
  }

  if (whatsapp.status === "connected" && whatsapp.phoneNumberId) {
    const connectedAt = formatConnectedAt(whatsapp.connectedAt);
    return (
      <SettingsPanelShell title="WhatsApp" description="Business messaging inbox">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center gap-4 border-b border-border/60 bg-emerald-500/5 p-5">
              <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-card">
                <ChannelBrandIcon channel="whatsapp" className="size-8" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Connected
                  </span>
                </div>
                <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                  {whatsapp.verifiedName || "WhatsApp Business"}
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3.5" />
                  {whatsapp.displayPhoneNumber || whatsapp.phoneNumberId}
                  {connectedAt ? ` · linked ${connectedAt}` : ""}
                </p>
              </div>
              <Link
                href="/inbox"
                className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
              >
                <Inbox className="size-4" />
                Open inbox
              </Link>
            </div>

            <div className="grid gap-px bg-border/60 sm:grid-cols-3">
              {CAPABILITIES.map((cap) => (
                <div key={cap.title} className="bg-card p-4">
                  <cap.icon className="size-5 text-primary" />
                  <p className="mt-2 text-sm font-medium text-foreground">{cap.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {cap.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            New WhatsApp messages to{" "}
            <span className="font-medium text-foreground">
              {whatsapp.displayPhoneNumber || "your number"}
            </span>{" "}
            arrive in your inbox as WhatsApp tickets. Replies you send there are delivered straight
            back to the customer on WhatsApp.
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={startConnect}
              disabled={connecting || !sdkReady}
            >
              {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Switch number
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => void disconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 size-4" />
              )}
              Disconnect
            </Button>
          </div>
        </div>
      </SettingsPanelShell>
    );
  }

  return (
    <SettingsPanelShell title="WhatsApp" description="Business messaging inbox">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 to-transparent px-6 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-sm">
            <ChannelBrandIcon channel="whatsapp" className="size-9" />
          </div>
          <h4 className="mt-5 text-xl font-semibold text-foreground">
            Manage WhatsApp chats from Agentra
          </h4>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Connect your existing WhatsApp Business number so incoming messages become tickets your
            whole team can answer without leaving Agentra.
          </p>
          <Button
            type="button"
            className="mt-6 bg-[#25D366] text-white hover:bg-[#1FB855]"
            size="lg"
            onClick={startConnect}
            disabled={connecting || !sdkReady}
          >
            {connecting || !sdkReady ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ChannelBrandIcon channel="whatsapp" className="mr-2 size-4" monochrome />
            )}
            {sdkReady ? "Connect WhatsApp" : "Preparing…"}
          </Button>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            You&apos;ll pick your WhatsApp Business account and number in the popup
          </p>
          {whatsapp.lastError ? (
            <p className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {whatsapp.lastError}
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-card p-5 text-left">
          <p className="text-sm font-medium text-foreground">Connect Meta test number</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Use this while Embedded Signup is blocked. Paste values from Meta → WhatsApp →
            API Setup / Try it out, then reply from your phone to open a ticket in Agentra.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-access-token">Temporary access token</Label>
              <Input
                id="wa-access-token"
                type="password"
                autoComplete="off"
                value={manualAccessToken}
                onChange={(e) => setManualAccessToken(e.target.value)}
                placeholder="Paste Meta temporary access token"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wa-waba-id">WhatsApp Business Account ID</Label>
                <Input
                  id="wa-waba-id"
                  value={manualWabaId}
                  onChange={(e) => setManualWabaId(e.target.value)}
                  placeholder="e.g. 3852349935059466"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-phone-id">Phone number ID</Label>
                <Input
                  id="wa-phone-id"
                  value={manualPhoneNumberId}
                  onChange={(e) => setManualPhoneNumberId(e.target.value)}
                  placeholder="e.g. 1060962130426709"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void connectManual()}
              disabled={manualConnecting}
            >
              {manualConnecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Link test number
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="rounded-xl border border-border/70 bg-card p-4">
              <cap.icon className="size-5 text-primary" />
              <p className="mt-2 text-sm font-medium text-foreground">{cap.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {cap.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-5">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">How it works</p>
          </div>
          <ol className="mt-3 space-y-2.5">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SettingsPanelShell>
  );
}
