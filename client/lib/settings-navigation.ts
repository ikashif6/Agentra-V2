import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Clock,
  Mail,
  MessageCircle,
  Users,
  UsersRound,
  ContactRound,
  Shield,
  CreditCard,
  ScrollText,
  Bell,
  Palette,
  Store,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type SettingsItemId =
  | "store"
  | "customize-workspace"
  | "business-hours"
  | "ai-agent"
  | "helpdesk-ai"
  | "email"
  | "chat"
  | "whatsapp"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "users"
  | "customers"
  | "teams"
  | "access"
  | "billing"
  | "audit-logs"
  | "notifications"
  | "password-security";

export type SettingsSectionId = "workspace" | "channels" | "account";

export type SettingsNavItem = {
  id: SettingsItemId;
  label: string;
  description?: string;
  /** owner + admin only (workspace config / channels) */
  configOnly?: boolean;
  staffOnly?: boolean;
  ownerOnly?: boolean;
  /** users/teams — also managers */
  peopleOk?: boolean;
};

export type SettingsNavSection = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  configOnly?: boolean;
  staffOnly?: boolean;
  items: SettingsNavItem[];
};

export const SETTINGS_SECTIONS: SettingsNavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Building2,
    configOnly: true,
    items: [
      { id: "store", label: "Store", description: "Connect Shopify, WooCommerce, or a custom storefront", configOnly: true },
      { id: "customize-workspace", label: "Customize workspace", description: "Brand colors, logos, and how Agentra appears", configOnly: true },
      { id: "business-hours", label: "Business hours", description: "When your team is typically available", configOnly: true },
      {
        id: "ai-agent",
        label: "AI Agent",
        description: "Guide AI across email, chat, and social channels",
        configOnly: true,
      },
      {
        id: "helpdesk-ai",
        label: "Helpdesk AI",
        description: "Inbox copilots, manager QA, and knowledge insights",
        configOnly: true,
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: MessageCircle,
    configOnly: true,
    items: [
      { id: "email", label: "Email", description: "Bring support mail into your inbox", configOnly: true },
      { id: "chat", label: "Live chat", description: "Website widget conversations", configOnly: true },
      { id: "whatsapp", label: "WhatsApp", description: "Connect WhatsApp Business", configOnly: true },
      { id: "instagram", label: "Instagram", description: "Direct messages on Instagram", configOnly: true },
      { id: "facebook", label: "Facebook", description: "Messenger and page conversations", configOnly: true },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: UsersRound,
    items: [
      { id: "password-security", label: "Password & security" },
      { id: "users", label: "Users", description: "Invite and manage people in this workspace", peopleOk: true },
      {
        id: "customers",
        label: "Customers",
        description: "People who reached out and what they purchased",
      },
      { id: "teams", label: "Teams", description: "Groups for routing and ownership", peopleOk: true },
      { id: "access", label: "Roles & permissions", description: "Control what each role can do", ownerOnly: true },
      { id: "billing", label: "Plan & billing", description: "Subscription and usage", ownerOnly: true },
      { id: "audit-logs", label: "Activity log", description: "Recent activity in this workspace", configOnly: true },
      { id: "notifications", label: "Notifications", description: "Sounds and browser alerts" },
    ],
  },
];

const LEGACY_TAB_MAP: Record<string, SettingsItemId> = {
  security: "password-security",
  workspace: "store",
};

export function resolveSettingsItem(
  itemParam: string | null,
  tabParam: string | null,
): SettingsItemId {
  if (itemParam && isValidItemId(itemParam)) return itemParam;
  if (tabParam && LEGACY_TAB_MAP[tabParam]) return LEGACY_TAB_MAP[tabParam];
  return "password-security";
}

function isValidItemId(id: string): id is SettingsItemId {
  return SETTINGS_SECTIONS.some((section) => section.items.some((item) => item.id === id));
}

export function findSettingsItem(id: SettingsItemId) {
  for (const section of SETTINGS_SECTIONS) {
    const item = section.items.find((entry) => entry.id === id);
    if (item) return { section, item };
  }
  return null;
}

export function canConfigureWorkspace(role?: Role | null) {
  return role === "owner" || role === "admin";
}

export function canManagePeople(role?: Role | null) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function visibleSettingsSections(options: {
  role?: Role | null;
  /** @deprecated use role */
  isStaff?: boolean;
  isOwner?: boolean;
}): SettingsNavSection[] {
  const role = options.role
    ?? (options.isOwner ? "owner" : options.isStaff ? "admin" : "agent");
  const isOwner = role === "owner";
  const canConfig = canConfigureWorkspace(role);
  const canPeople = canManagePeople(role);

  return SETTINGS_SECTIONS.map((section) => {
    if (section.configOnly && !canConfig) return null;

    const items = section.items.filter((item) => {
      if (item.ownerOnly && !isOwner) return false;
      if (item.peopleOk) return canPeople;
      if (item.configOnly && !canConfig) return false;
      if (item.staffOnly && !canConfig) return false;
      return true;
    });
    if (items.length === 0) return null;
    return { ...section, items };
  }).filter(Boolean) as SettingsNavSection[];
}

export const SETTINGS_ITEM_ICONS: Partial<Record<SettingsItemId, LucideIcon>> = {
  store: Store,
  "customize-workspace": Palette,
  "business-hours": Clock,
  email: Mail,
  chat: MessageCircle,
  users: Users,
  customers: ContactRound,
  teams: UsersRound,
  access: Shield,
  billing: CreditCard,
  "audit-logs": ScrollText,
  notifications: Bell,
};
