import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Clock,
  HelpCircle,
  Mail,
  MessageCircle,
  Users,
  UsersRound,
  Shield,
  CreditCard,
  ScrollText,
  Bell,
  Palette,
  Store,
} from "lucide-react";

export type SettingsItemId =
  | "store"
  | "customize-workspace"
  | "business-hours"
  | "help-center"
  | "email"
  | "chat"
  | "whatsapp"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "users"
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
  staffOnly?: boolean;
  ownerOnly?: boolean;
};

export type SettingsNavSection = {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  staffOnly?: boolean;
  items: SettingsNavItem[];
};

export const SETTINGS_SECTIONS: SettingsNavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Building2,
    staffOnly: true,
    items: [
      { id: "store", label: "Store", description: "Connect Shopify, WooCommerce, or custom storefront" },
      { id: "customize-workspace", label: "Customize workspace", description: "Logo, brand color, and theme" },
      { id: "business-hours", label: "Business hours", description: "When your team is available" },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    icon: MessageCircle,
    staffOnly: true,
    items: [
      { id: "email", label: "Email", description: "Inbound and outbound mail" },
      { id: "chat", label: "Live chat", description: "Website widget conversations" },
      { id: "whatsapp", label: "WhatsApp", description: "Connect WhatsApp Business" },
      { id: "tiktok", label: "TikTok", description: "Social messaging on TikTok" },
      { id: "instagram", label: "Instagram", description: "Direct messages on Instagram" },
      { id: "facebook", label: "Facebook", description: "Messenger and page inbox" },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: UsersRound,
    items: [
      { id: "password-security", label: "Password & security" },
      { id: "users", label: "Users", description: "Invite and manage workspace members", staffOnly: true },
      { id: "teams", label: "Teams", description: "Groups and routing", staffOnly: true },
      { id: "access", label: "Roles & permissions", description: "Who can do what", staffOnly: true, ownerOnly: true },
      { id: "billing", label: "Plan & billing", description: "Subscription and usage", staffOnly: true, ownerOnly: true },
      { id: "audit-logs", label: "Activity log", description: "Recent workspace events", staffOnly: true },
      { id: "notifications", label: "Notifications", description: "Sounds and browser alerts" },
    ],
  },
];

const LEGACY_TAB_MAP: Record<string, SettingsItemId> = {
  security: "password-security",
  workspace: "store",
  helpcenter: "help-center",
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

export function visibleSettingsSections(options: {
  isStaff: boolean;
  isOwner: boolean;
}): SettingsNavSection[] {
  const { isStaff, isOwner } = options;
  return SETTINGS_SECTIONS.map((section) => {
    if (section.staffOnly && !isStaff) return null;
    const items = section.items.filter((item) => {
      if (item.ownerOnly && !isOwner) return false;
      if (item.staffOnly && !isStaff) return false;
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
  "help-center": HelpCircle,
  email: Mail,
  chat: MessageCircle,
  users: Users,
  teams: UsersRound,
  access: Shield,
  billing: CreditCard,
  "audit-logs": ScrollText,
  notifications: Bell,
};
