"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  canConfigureWorkspace,
  canManagePeople,
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
import LiveChatSettingsPanel from "@/components/settings/live-chat-settings-panel";
import AiAgentSettingsPanel from "@/components/settings/ai-agent-settings-panel";
import HelpdeskAiSettingsPanel from "@/components/settings/helpdesk-ai-settings-panel";
import BillingPanel from "@/components/settings/billing-panel";
import AccessPermissionsPanel from "@/components/settings/access-permissions-panel";
import UsersSettingsPanel from "@/components/settings/users-settings-panel";
import CustomersSettingsPanel from "@/components/settings/customers-settings-panel";
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

  const role = user?.role ?? "customer";
  const canConfig = canConfigureWorkspace(role);
  const canPeople = canManagePeople(role);
  const isOwner = role === "owner";

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
        return canConfig ? <StoreSettingsPanel /> : <PasswordSecurityPanel />;
      case "customize-workspace":
        return canConfig ? <CustomizeWorkspacePanel /> : null;
      case "business-hours":
        return canConfig ? <BusinessHoursPanel /> : null;
      case "ai-agent":
        return canConfig ? <AiAgentSettingsPanel /> : null;
      case "helpdesk-ai":
        return canConfig ? <HelpdeskAiSettingsPanel /> : null;
      case "email":
        return canConfig ? <EmailSettingsPanel /> : null;
      case "chat":
        return canConfig ? <LiveChatSettingsPanel /> : null;
      case "whatsapp":
        return canConfig ? <WhatsAppSettingsPanel /> : null;
      case "instagram":
        return canConfig ? <InstagramSettingsPanel /> : null;
      case "facebook":
        return canConfig ? <FacebookSettingsPanel /> : null;
      case "users":
        return canPeople ? <UsersSettingsPanel /> : null;
      case "customers":
        return ["owner", "admin", "manager", "agent"].includes(role) ? (
          <CustomersSettingsPanel />
        ) : null;
      case "teams":
        return canPeople ? <TeamsSettingsPanel /> : null;
      case "access":
        return isOwner ? <AccessPermissionsPanel /> : null;
      case "billing":
        return isOwner ? <BillingPanel /> : null;
      case "audit-logs":
        return canConfig ? <ActivityLogPanel /> : null;
      case "notifications":
        return <NotificationsPanel />;
      default:
        return <PasswordSecurityPanel />;
    }
  }, [activeItem, canConfig, canPeople, isOwner, role]);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen ? (
          <SettingsSidebar
            activeItem={activeItem}
            onSelect={selectItem}
            role={role}
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
