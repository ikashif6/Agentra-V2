"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  findSettingsItem,
  resolveSettingsItem,
  type SettingsItemId,
} from "@/lib/settings-navigation";
import SettingsSidebar from "@/components/settings/settings-sidebar";
import PasswordSecurityPanel from "@/components/settings/password-security-panel";
import StoreSettingsPanel from "@/components/settings/store-settings-panel";
import FacebookSettingsPanel from "@/components/settings/facebook-settings-panel";
import InstagramSettingsPanel from "@/components/settings/instagram-settings-panel";
import WhatsAppSettingsPanel from "@/components/settings/whatsapp-settings-panel";
import EmailSettingsPanel from "@/components/settings/email-settings-panel";
import BusinessHoursPanel from "@/components/settings/business-hours-panel";
import {
  AccountPlaceholderPanel,
  ChannelPlaceholderPanel,
} from "@/components/settings/settings-placeholders";
import BillingPanel from "@/components/settings/billing-panel";
import AccessPermissionsPanel from "@/components/settings/access-permissions-panel";
import UsersSettingsPanel from "@/components/settings/users-settings-panel";
import TeamsSettingsPanel from "@/components/settings/teams-settings-panel";
import ActivityLogPanel from "@/components/settings/activity-log-panel";
import NotificationsPanel from "@/components/settings/notifications-panel";
import CustomizeWorkspacePanel from "@/components/settings/customize-workspace-panel";

function PanelLoading() {
  return (
    <div className="flex justify-center py-16">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const isStaff = ["owner", "admin"].includes(user?.role ?? "");
  const isOwner = user?.role === "owner";

  const activeItem = resolveSettingsItem(
    searchParams.get("item"),
    searchParams.get("tab"),
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "profile") {
      router.replace("/profile");
    }
  }, [searchParams, router]);

  const selectItem = useCallback(
    (id: SettingsItemId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.set("item", id);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const meta = useMemo(() => findSettingsItem(activeItem), [activeItem]);

  const panel = useMemo(() => {
    switch (activeItem) {
      case "password-security":
        return <PasswordSecurityPanel />;
      case "store":
        return isStaff ? <StoreSettingsPanel /> : <PasswordSecurityPanel />;
      case "customize-workspace":
        return isStaff ? <CustomizeWorkspacePanel /> : null;
      case "business-hours":
        return isStaff ? <BusinessHoursPanel /> : null;
      case "email":
        return isStaff ? <EmailSettingsPanel /> : null;
      case "chat":
        return isStaff ? (
          <ChannelPlaceholderPanel
            title="Live chat"
            description="Add a chat widget to your site and route conversations to your team"
          />
        ) : null;
      case "whatsapp":
        return isStaff ? <WhatsAppSettingsPanel /> : null;
      case "tiktok":
        return isStaff ? (
          <ChannelPlaceholderPanel
            title="TikTok"
            description="Reply to TikTok direct messages alongside other channels"
          />
        ) : null;
      case "instagram":
        return isStaff ? <InstagramSettingsPanel /> : null;
      case "facebook":
        return isStaff ? <FacebookSettingsPanel /> : null;
      case "users":
        return isStaff ? <UsersSettingsPanel /> : null;
      case "teams":
        return isStaff ? <TeamsSettingsPanel /> : null;
      case "access":
        return isOwner ? <AccessPermissionsPanel /> : null;
      case "billing":
        return isOwner ? <BillingPanel /> : null;
      case "audit-logs":
        return isStaff ? <ActivityLogPanel /> : null;
      case "notifications":
        return <NotificationsPanel />;
      default:
        return <PasswordSecurityPanel />;
    }
  }, [activeItem, isStaff, isOwner]);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen ? (
          <SettingsSidebar
            activeItem={activeItem}
            onSelect={selectItem}
            isStaff={isStaff}
            isOwner={isOwner}
            onCollapse={() => setSidebarOpen(false)}
          />
        ) : null}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            {!sidebarOpen ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                aria-label="Show settings menu"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-foreground">
                {meta?.item.label ?? "Settings"}
              </h1>
              {meta?.item.description ? (
                <p className="truncate text-xs text-muted-foreground">{meta.item.description}</p>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-10 md:px-8">
            <div className="w-full">{panel}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
