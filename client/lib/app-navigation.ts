import {
  Home,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { AiAgentIcon } from "@/components/icons/ai-agent-icon";
import { AnalyticsIcon } from "@/components/icons/analytics-icon";
import { Role } from "@/lib/types";

export type AppNavIcon = LucideIcon | typeof AiAgentIcon | typeof AnalyticsIcon;

export type AppNavItem = {
  label: string;
  href: string;
  icon: AppNavIcon;
  roles: Role[];
  customerLabel?: string;
};

export const PRIMARY_NAV: AppNavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: Home,
    roles: ["owner", "admin", "manager", "agent", "customer"],
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
    roles: ["owner", "admin", "manager", "agent", "customer"],
    customerLabel: "My tickets",
  },
  {
    label: "AI Agent",
    href: "/ai-agent",
    icon: AiAgentIcon,
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: AnalyticsIcon,
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["owner", "admin", "manager", "agent", "customer"],
  },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/";
  }

  const baseHref = href.split("?")[0];

  if (baseHref === "/settings") {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }

  if (baseHref === "/profile") {
    return pathname === "/profile" || pathname.startsWith("/profile/");
  }

  if (baseHref === "/ai-agent") {
    return (
      pathname === "/ai-agent"
      || pathname.startsWith("/ai-agent/")
      || pathname === "/ai-agents"
      || pathname.startsWith("/ai-agents/")
      || pathname === "/live-chat"
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
