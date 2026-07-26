"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveChatSettings } from "@/lib/types";
import { API_BASE } from "@/lib/constants";

function apiOriginFromBase(apiBase: string) {
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

/** Map dashboard live-chat settings → public widget config (same shape as /api/v1/widget/config). */
export function settingsToWidgetPreviewConfig(settings: LiveChatSettings) {
  const content = settings.content || {};
  const appearance = settings.appearance || {};
  const agents = Array.isArray(settings.agents) ? settings.agents : [];

  return {
    enabled: true,
    agentName: content.agentName || "Support Assistant",
    storeName: content.storeDisplayName || "Your store",
    widgetColor: appearance.brandColor || "#2563eb",
    backgroundColor: appearance.backgroundColor || "#ffffff",
    fontFamily: appearance.fontFamily || "Plus Jakarta Sans",
    logoUrl: appearance.logoUrl || null,
    faviconUrl: appearance.faviconUrl || null,
    logoSize: appearance.logoSize || "medium",
    logoWidth: Number(appearance.logoWidth) || 120,
    logoHeight: Number(appearance.logoHeight) || 40,
    position: appearance.position || "bottom-right",
    launcherOffsetX: appearance.launcherOffsetX ?? 20,
    launcherOffsetY: appearance.launcherOffsetY ?? 20,
    welcomeTitle: content.welcomeTitle || "Hi there 👋\nHow can we help?",
    welcomeSubtitle:
      content.welcomeSubtitle || "Ask about orders, products, returns & store support.",
    welcomeMsg:
      content.welcomeMessage ||
      "I'm here to help with orders, products, and store questions.",
    emailGateTitle: content.emailGateTitle || "Start a conversation",
    emailGateSubtitle:
      content.emailGateSubtitle || "Enter your email so we can follow up with you.",
    privacyNotice:
      content.privacyNotice ||
      "This chat is AI-powered for faster assistance. Chats are monitored and recorded.",
    privacyPolicyLabel: content.privacyPolicyLabel || "Privacy Policy",
    privacyPolicyUrl: content.privacyPolicyUrl || "",
    askAnythingLabel: content.askAnythingLabel || "Ask me anything",
    offlineMessage: content.offlineMessage,
    quickReplies: (content.quickReplies || []).filter(Boolean).slice(0, 8),
    showBranding: appearance.showBranding !== false,
    behavior: settings.behavior || { retrievalIndicator: true },
    teamAgents: agents.slice(0, 5).map((a) => ({
      initials: a.initials,
      name: a.fullName,
      avatarUrl: a.avatar || null,
      color: a.color,
      isOnline: true,
    })),
  };
}

/**
 * Live preview of the real storefront widget (`/widget.js`).
 * Not a separate UI — settings are pushed into the exact widget template.
 */
export default function LiveChatWidgetPreview({ settings }: { settings: LiveChatSettings }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const previewUrl = useMemo(
    () => `${apiOriginFromBase(API_BASE)}/widget-preview`,
    [],
  );
  const config = useMemo(() => settingsToWidgetPreviewConfig(settings), [settings]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "agentra-preview-ready") {
        setReady(true);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const timer = window.setTimeout(() => {
      win.postMessage({ type: "agentra-preview-config", config }, "*");
    }, 120);
    return () => window.clearTimeout(timer);
  }, [config, ready]);

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Live preview</p>
          <p className="text-xs text-muted-foreground">
            Exact storefront widget — updates as you edit settings
          </p>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-border/70 bg-[#e8ecf0] shadow-sm">
        <iframe
          ref={iframeRef}
          title="Live chat widget preview"
          src={previewUrl}
          className="block h-[640px] w-full border-0 bg-[#e8ecf0]"
          onLoad={() => {
            const win = iframeRef.current?.contentWindow;
            if (!win) return;
            win.postMessage({ type: "agentra-preview-config", config }, "*");
          }}
        />
      </div>
    </div>
  );
}
