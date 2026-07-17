"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CheckCheck, Loader2, Menu, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocalTime } from "@/hooks/use-user-local-time";
import { ticketApi } from "@/lib/api";
import { Ticket as TicketType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { findSettingsItem, resolveSettingsItem } from "@/lib/settings-navigation";
import { resolveWorkspaceDocumentTitle } from "@/lib/workspace-branding";

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

function formatRelative(str: string) {
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, company } = useAuth();
  const { time, weekdayDate, zoneLabel } = useUserLocalTime();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TicketType[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [notifications, setNotifications] = useState<TicketType[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const title =
    Object.entries(PAGE_TITLES).find(
      ([key]) => pathname === key || pathname.startsWith(key + "/"),
    )?.[1] ?? "Home";
  const displayTitle = title === "Tickets" && user?.role === "customer" ? "My Tickets" : title;
  const tagline = company?.branding?.tagline?.trim() || null;

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

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const { data } = await ticketApi.list({ status: "open", limit: 8 });
      setNotifications(data.data.tickets);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    loadNotifications();
  }, [notificationsOpen, loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-notifications-root]")) {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await ticketApi.list({ search: searchQuery.trim(), limit: 8 });
        setSearchResults(data.data.tickets);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openTicket = (code: string) => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    router.push(`/inbox?ticket=${code}`);
  };

  const unreadCount = notifications.filter((ticket) => ticket.isUnread).length;

  const markAllRead = async () => {
    if (markingRead || notifications.length === 0) return;
    const unread = notifications.filter((ticket) => ticket.isUnread);
    setMarkingRead(true);
    setNotifications((prev) => prev.map((ticket) => ({ ...ticket, isUnread: false })));
    try {
      if (unread.length > 0) {
        await Promise.all(
          unread.map((ticket) => ticketApi.update(ticket.ticket_code, { isUnread: false })),
        );
      }
      toast.success(
        unread.length > 0 ? "All notifications marked as read" : "You're all caught up",
      );
    } catch {
      await loadNotifications();
      toast.error("Could not mark all as read");
    } finally {
      setMarkingRead(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/85 px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">{displayTitle}</h1>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              {tagline ? `${tagline} · ` : ""}
              {weekdayDate} · {time} ({zoneLabel})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Search"
          >
            <Search className="size-5" />
          </button>

          <div className="relative" data-notifications-root>
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-card bg-primary" />
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-foreground">Notifications</p>
                    <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                      {unreadCount > 0
                        ? `${unreadCount} unread`
                        : notifications.length > 0
                          ? `${notifications.length} open conversation${notifications.length === 1 ? "" : "s"}`
                          : "No open conversations"}
                    </p>
                  </div>
                  {notifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={markAllRead}
                      disabled={markingRead}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      {markingRead ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      ) : (
                        <CheckCheck className="size-3.5 shrink-0" />
                      )}
                      <span className="whitespace-nowrap">
                        {markingRead ? "Marking…" : "Mark all as read"}
                      </span>
                    </button>
                  ) : null}
                </div>

                <div className="max-h-80 overflow-y-auto p-1">
                  {notificationsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                      You&apos;re all caught up.
                    </p>
                  ) : (
                    notifications.map((ticket) => (
                      <button
                        key={ticket._id}
                        type="button"
                        onClick={() => openTicket(ticket.ticket_code)}
                        className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {ticket.isUnread ? (
                              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                            ) : null}
                            <p className="line-clamp-1 text-sm font-medium text-foreground">
                              {ticket.ticket_title}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatRelative(ticket.lastActivity || ticket.createdAt)}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-primary">{ticket.ticket_code}</p>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-t border-border/60 p-1">
                  <Link
                    href="/inbox"
                    onClick={() => setNotificationsOpen(false)}
                    className="flex justify-center rounded-lg py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
                  >
                    View all in inbox
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="text-sm font-semibold">Search workspace</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border/60 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations, codes, subjects…"
                className="pl-9"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Tip: press <kbd className="rounded border px-1">Ctrl</kbd>+<kbd className="rounded border px-1">K</kbd> anywhere
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {searchLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : !searchQuery.trim() ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Start typing to search conversations.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No results for &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              searchResults.map((ticket) => (
                <button
                  key={ticket._id}
                  type="button"
                  onClick={() => openTicket(ticket.ticket_code)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  )}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Ticket className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {ticket.ticket_title}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                      {ticket.ticket_code}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          {searchResults.length > 0 ? (
            <div className="border-t border-border/60 p-2">
              <Button
                variant="ghost"
                className="w-full text-primary"
                onClick={() => {
                  setSearchOpen(false);
                  router.push(`/inbox${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ""}`);
                }}
              >
                View all in inbox
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
