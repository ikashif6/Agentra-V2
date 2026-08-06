"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocalTime } from "@/hooks/use-user-local-time";
import { findSettingsItem, resolveSettingsItem } from "@/lib/settings-navigation";
import { resolveWorkspaceDocumentTitle } from "@/lib/workspace-branding";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/inbox": "Inbox",
  "/ai-agent": "AI Agent",
  "/ai-agents": "AI Agent",
  "/live-chat": "AI Agent",
  "/chatbot": "Chatbot",
  "/analytics": "Analytics",
  "/departments": "Departments",
  "/teams": "Teams",
  "/agents": "Agents",
  "/tickets": "Tickets",
  "/settings": "Settings",
  "/profile": "Profile",
};

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, company } = useAuth();
  const { time, weekdayDate, zoneLabel } = useUserLocalTime();

  const title =
    Object.entries(PAGE_TITLES).find(
      ([key]) => pathname === key || pathname.startsWith(key + "/"),
    )?.[1] ?? "Home";
  const displayTitle = title === "Tickets" && user?.role === "customer" ? "My Tickets" : title;
  const tagline = company?.branding?.tagline?.trim() || null;
  const isFullBleed = ["/inbox", "/ai-agent", "/ai-agents", "/live-chat", "/settings"].some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`),
  );

  useEffect(() => {
    const settingsItem = pathname.startsWith("/settings")
      ? resolveSettingsItem(searchParams.get("item"), searchParams.get("tab"))
      : null;
    const settingsMeta = settingsItem ? findSettingsItem(settingsItem) : null;

    let pageLabel: string | null = displayTitle;
    if (pathname.startsWith("/settings")) {
      pageLabel = settingsMeta?.section.label ?? "Settings";
    }

    document.title = resolveWorkspaceDocumentTitle({
      pathname,
      settingsItem,
      browserTitle: company?.branding?.browserTitle,
      tagline: company?.branding?.tagline,
      companyName: company?.name,
      pageLabel,
    });
  }, [
    pathname,
    searchParams,
    displayTitle,
    company?.branding?.browserTitle,
    company?.branding?.tagline,
    company?.name,
  ]);

  return (
    <header
      className={cn(
        "flex min-h-[4.75rem] shrink-0 items-center justify-between bg-background px-5 py-5 md:px-6",
        // Full-bleed surfaces (inbox / AI Agent / settings) draw their own toolbar divider.
        !isFullBleed && "border-b border-border/50",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">{displayTitle}</h1>
          <p className="mt-0.5 hidden text-[12px] tracking-[-0.01em] text-muted-foreground sm:block">
            {tagline ? `${tagline} · ` : ""}
            {weekdayDate} · {time} ({zoneLabel})
          </p>
        </div>
      </div>
    </header>
  );
}
