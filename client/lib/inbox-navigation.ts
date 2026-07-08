import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Clock,
  Inbox,
  Trash2,
  UserCheck,
} from "lucide-react";
import { SpamIcon } from "@/components/icons/spam-icon";
import type { InboxView } from "@/lib/types";

export type InboxNavIcon = LucideIcon | typeof SpamIcon;

export type InboxNavItem = {
  id: InboxView;
  label: string;
  icon: InboxNavIcon;
  agentOnly?: boolean;
};

export const STAFF_INBOX_VIEWS: InboxNavItem[] = [
  { id: "assigned", label: "Assigned to me", icon: UserCheck, agentOnly: true },
  { id: "all", label: "All", icon: Inbox },
  { id: "snoozed", label: "Snoozed", icon: Clock },
  { id: "closed", label: "Closed", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "spam", label: "Spam", icon: SpamIcon },
];

export const CUSTOMER_INBOX_VIEWS: InboxNavItem[] = [
  { id: "all", label: "All", icon: Inbox },
  { id: "closed", label: "Closed", icon: Archive },
];

export function inboxViewsForRole(role: string): InboxNavItem[] {
  if (role === "customer") return CUSTOMER_INBOX_VIEWS;
  return STAFF_INBOX_VIEWS.filter((view) => !view.agentOnly || role === "agent");
}

export function defaultInboxViewForRole(role: string): InboxView {
  if (role === "agent") return "assigned";
  return "all";
}
