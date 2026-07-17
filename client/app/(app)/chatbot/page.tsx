"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessageCircle, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { AgentraWidgetEmbed } from "@/components/chatbot/agentra-widget-embed";
import { Button } from "@/components/ui/button";
import { liveChatApi, storeApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import { APP_CARD } from "@/lib/app-surfaces";
import { cn } from "@/lib/utils";

type LiveChatSnapshot = {
  enabled?: boolean;
  widgetKey?: string;
  content?: { agentName?: string };
};

type StoreSnapshot = {
  status?: string;
  provider?: string;
  shopify?: { shopName?: string; shopDomain?: string };
  woocommerce?: { storeName?: string; storeUrl?: string };
  custom?: { storeName?: string; storeUrl?: string };
};

/**
 * Isolated chatbot playground — real widget + connected store.
 * Helpdesk / inbox stay untouched; wire this surface in later when the widget is ready.
 */
export default function ChatbotPlaygroundPage() {
  const [loading, setLoading] = useState(true);
  const [liveChat, setLiveChat] = useState<LiveChatSnapshot | null>(null);
  const [store, setStore] = useState<StoreSnapshot | null>(null);
  const [widgetOn, setWidgetOn] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chatRes, storeRes] = await Promise.allSettled([
        liveChatApi.getSettings(),
        storeApi.getStatus(),
      ]);

      if (chatRes.status === "fulfilled") {
        const lc = chatRes.value.data?.data?.liveChat as LiveChatSnapshot | undefined;
        setLiveChat(lc ?? null);
      } else {
        setLiveChat(null);
        const { message } = getApiError(chatRes.reason, "Could not load live chat settings");
        toast.error(message);
      }

      if (storeRes.status === "fulfilled") {
        const s = storeRes.value.data?.data?.store as StoreSnapshot | undefined;
        setStore(s ?? null);
      } else {
        setStore(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const widgetKey = liveChat?.widgetKey?.trim() || "";
  const chatReady = Boolean(liveChat?.enabled && widgetKey);
  const storeConnected = store?.status === "connected";
  const storeLabel =
    store?.shopify?.shopName
    || store?.shopify?.shopDomain
    || store?.woocommerce?.storeName
    || store?.woocommerce?.storeUrl
    || store?.custom?.storeName
    || store?.custom?.storeUrl
    || (storeConnected ? "Connected store" : "No store connected");
  const agentName = liveChat?.content?.agentName?.trim() || "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          <MessageCircle className="size-3.5" />
          Widget playground
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Chatbot</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Build and test the storefront chatbot here against your connected Shopify store. Helpdesk
          stays separate until this widget is ready to wire in.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className={cn(APP_CARD, "space-y-4 p-5")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground">Playground status</p>
                <p className="text-sm text-muted-foreground">
                  The floating launcher uses the same embed as your storefront.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void load()}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Refresh
              </Button>
            </div>

            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3 rounded-xl border border-border/60 px-3.5 py-3">
                <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Shopify store</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {storeConnected ? storeLabel : "Connect a store to test orders and catalog tools."}
                  </p>
                  {!storeConnected ? (
                    <Link
                      href="/settings?item=store"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Open store settings
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : null}
                </div>
                <StatusPill ok={storeConnected} okLabel="Connected" badLabel="Not connected" />
              </li>

              <li className="flex items-start gap-3 rounded-xl border border-border/60 px-3.5 py-3">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Live chat widget</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {chatReady
                      ? `Ready${agentName ? ` · ${agentName}` : ""}`
                      : "Enable live chat and save settings to generate a widget key."}
                  </p>
                  {!chatReady ? (
                    <Link
                      href="/settings?item=chat"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Open live chat settings
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : null}
                </div>
                <StatusPill ok={chatReady} okLabel="Ready" badLabel="Not ready" />
              </li>
            </ul>

            {chatReady ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
                <Button
                  type="button"
                  variant={widgetOn ? "outline" : "default"}
                  size="sm"
                  onClick={() => setWidgetOn((v) => !v)}
                >
                  {widgetOn ? "Hide widget" : "Show widget"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use the bottom-right launcher to chat. Conversations land in AI Agent.
                </p>
              </div>
            ) : null}
          </section>

          <section className="relative min-h-[280px] overflow-hidden rounded-2xl border border-dashed border-border/80 bg-gradient-to-br from-muted/40 via-background to-muted/20 px-6 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.04),transparent_55%)]" />
            <div className="relative max-w-md space-y-2">
              <p className="text-sm font-semibold text-foreground">Storefront canvas</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This page stands in for your Shopify storefront. Open the chat launcher to exercise
                knowledge, order lookup, and product tools against the connected store — without
                touching helpdesk.
              </p>
            </div>
          </section>
        </>
      )}

      {chatReady && widgetOn ? <AgentraWidgetEmbed widgetKey={widgetKey} /> : null}
    </div>
  );
}

function StatusPill({
  ok,
  okLabel,
  badLabel,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        ok
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
          : "bg-muted text-muted-foreground ring-1 ring-border",
      )}
    >
      {ok ? okLabel : badLabel}
    </span>
  );
}
