import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Inbox,
  Trash2,
} from "lucide-react";
import type { LiveChatView } from "@/lib/types";

export type LiveChatNavItem = {
  id: LiveChatView;
  label: string;
  icon: LucideIcon;
  agentOnly?: boolean;
};

export const LIVE_CHAT_VIEWS: LiveChatNavItem[] = [
  { id: "queue", label: "Queue", icon: Inbox },
  { id: "closed", label: "Resolved", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function liveChatViewsForRole(role: string): LiveChatNavItem[] {
  return LIVE_CHAT_VIEWS;
}

export function defaultLiveChatViewForRole(_role: string): LiveChatView {
  return "queue";
}

/** @deprecated */
export const AI_AGENT_VIEWS = LIVE_CHAT_VIEWS;
/** @deprecated */
export const aiAgentViewsForRole = liveChatViewsForRole;
/** @deprecated */
export const defaultAiAgentViewForRole = defaultLiveChatViewForRole;
