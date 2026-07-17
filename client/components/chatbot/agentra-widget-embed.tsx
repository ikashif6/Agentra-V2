"use client";

import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/constants";

type AgentraWidgetEmbedProps = {
  widgetKey: string;
  /** When false, tear down without mounting. */
  active?: boolean;
};

function apiOriginFromBase(apiBase: string) {
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

/**
 * Mounts the real Agentra storefront widget (same script as Shopify embeds).
 * Isolated from helpdesk — for /chatbot playground only.
 */
export function AgentraWidgetEmbed({ widgetKey, active = true }: AgentraWidgetEmbedProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!active || !widgetKey) return;

    const apiOrigin = apiOriginFromBase(API_BASE);
    const apiBase = `${API_BASE.replace(/\/$/, "")}/widget`;

    window.AgentraConfig = {
      widgetKey,
      apiBase,
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-agentra-playground="1"]',
    );
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = `${apiOrigin}/widget.js`;
    script.async = true;
    script.dataset.agentraPlayground = "1";
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      scriptRef.current?.remove();
      scriptRef.current = null;
      document.querySelector('script[data-agentra-playground="1"]')?.remove();
      document.getElementById("agentra-widget-root")?.remove();
      document.querySelector("style[data-agentra-widget-style]")?.remove();
      delete window.AgentraConfig;
    };
  }, [widgetKey, active]);

  return null;
}

declare global {
  interface Window {
    AgentraConfig?: {
      widgetKey?: string;
      key?: string;
      apiBase?: string;
    };
  }
}
