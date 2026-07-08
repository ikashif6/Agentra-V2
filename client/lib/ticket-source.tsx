import { Globe } from "lucide-react";
import type { TicketSource } from "@/lib/types";
import { ChannelBrandIcon, type ChannelBrandId } from "@/components/onboarding/channel-brand-icons";
import { cn } from "@/lib/utils";

export type SourceMeta = {
  label: string;
  channel?: ChannelBrandId;
  useLucide?: "portal";
};

export const TICKET_SOURCE_META: Record<TicketSource, SourceMeta> = {
  portal: { label: "Web", useLucide: "portal" },
  email: { label: "Email", channel: "email" },
  chat: { label: "Live chat", channel: "chat" },
  chatbot: { label: "Live chat", channel: "chat" },
  instagram: { label: "Instagram", channel: "instagram" },
  facebook: { label: "Facebook", channel: "facebook" },
  whatsapp: { label: "WhatsApp", channel: "whatsapp" },
};

/** Analytics labels — chat + chatbot merge into Live chat (AI Agent is the workspace, not the channel). */
export const ANALYTICS_SOURCE_LABELS: Record<string, string> = {
  email: "Email",
  portal: "Web",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  chat: "Live chat",
  chatbot: "Live chat",
  live_chat: "Live chat",
  ai_agent: "Live chat",
};

export function analyticsSourceKey(source?: string | null) {
  if (!source || source === "phone" || source === "api") return null;
  if (source === "chat" || source === "chatbot") return "live_chat";
  return source;
}

export function analyticsSourceLabel(sourceKey: string) {
  return ANALYTICS_SOURCE_LABELS[sourceKey] ?? sourceKey;
}

function SourceIconGraphic({
  source = "portal",
  className,
}: {
  source?: TicketSource;
  className?: string;
}) {
  const meta = TICKET_SOURCE_META[source] ?? TICKET_SOURCE_META.portal;

  if (meta.channel) {
    return <ChannelBrandIcon channel={meta.channel} className={className} />;
  }
  return <Globe className={cn("size-3.5 shrink-0", className)} />;
}

/** Compact icon for inbox list rows */
export function TicketSourceIcon({
  source = "portal",
  className,
}: {
  source?: TicketSource;
  className?: string;
}) {
  const meta = TICKET_SOURCE_META[source] ?? TICKET_SOURCE_META.portal;

  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40",
        className,
      )}
      title={meta.label}
    >
      <SourceIconGraphic source={source} className="size-3" />
    </span>
  );
}

export function TicketSourceBadge({
  source = "portal",
  className,
  showLabel = true,
}: {
  source?: TicketSource;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = TICKET_SOURCE_META[source] ?? TICKET_SOURCE_META.portal;

  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      title={`Opened via ${meta.label}`}
    >
      <SourceIconGraphic source={source} className="size-3.5" />
      {showLabel ? <span>{meta.label}</span> : null}
    </span>
  );
}
