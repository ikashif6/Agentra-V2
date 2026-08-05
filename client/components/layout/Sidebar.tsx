"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleHelp, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/lib/types";
import { PRIMARY_NAV, isNavActive, type AppNavItem } from "@/lib/app-navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { api, ticketApi } from "@/lib/api";
import { WorkspaceLogoImg } from "@/components/app/workspace-logo-img";
import {
  applyWorkspaceBranding,
  effectiveWorkspaceBranding,
  resolveWorkspaceLogoSrc,
  resolveWorkspaceTheme,
} from "@/lib/workspace-branding";
import { SITE_LEGAL } from "@/lib/site";

type SidebarProps = {
  embedded?: boolean;
};

function NavLink({
  item,
  role,
  pathname,
  collapsed,
  badgeCount,
}: {
  item: AppNavItem;
  role: Role;
  pathname: string;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const active = isNavActive(pathname, item.href);
  const label = role === "customer" && item.customerLabel ? item.customerLabel : item.label;
  const Icon = item.icon;
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel = badgeCount && badgeCount > 99 ? "99+" : String(badgeCount ?? 0);

  return (
    <Link
      href={item.href}
      title={collapsed ? (showBadge ? `${label} (${badgeLabel})` : label) : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            "size-[18px]",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
          aria-hidden="true"
        />
        {collapsed && showBadge ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {badgeLabel}
          </span>
        ) : null}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {showBadge ? (
            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground shadow-sm">
              {badgeLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function namePart(value?: string) {
  const v = (value || "").trim();
  return !v || v === "-" ? "" : v;
}

function userInitials(firstName?: string, lastName?: string) {
  const first = namePart(firstName)[0] ?? "";
  const last = namePart(lastName)[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function useMenuDismiss(
  refs: React.RefObject<HTMLElement | null>[],
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target));
      if (!inside) onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [refs, open, onClose]);
}

function ProfileAvatar({
  user,
  online,
  size = "sm",
}: {
  user: ReturnType<typeof useAuth>["user"];
  online: boolean;
  size?: "sm" | "default";
}) {
  return (
    <div className="relative shrink-0">
      <Avatar size={size}>
        {user?.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {userInitials(user?.firstName, user?.lastName)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card",
          online ? "bg-emerald-500" : "bg-muted-foreground/45",
        )}
        aria-hidden
      />
    </div>
  );
}

function SidebarAccountMenu({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const { user, company, logout, refreshUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [online, setOnline] = useState(user?.isOnline ?? true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const displayName =
    [namePart(user?.firstName), namePart(user?.lastName)].filter(Boolean).join(" ") ||
    (user?.fullName || "").trim().replace(/\s+-\s*$/, "") ||
    "Account";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOnline(user?.isOnline ?? true);
  }, [user?.isOnline]);

  useEffect(() => {
    const branding = effectiveWorkspaceBranding(user, company);
    if (!branding) return;
    setTheme(resolveWorkspaceTheme(branding.theme));
  }, [user?.preferences?.theme, company?.branding?.theme, user, company]);

  useMenuDismiss([anchorRef, panelRef], menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    if (!menuOpen) return;

    const updatePosition = () => updatePanelPosition();
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (menuOpen) updatePanelPosition();
  }, [menuOpen]);

  async function handleOnlineChange(checked: boolean) {
    setOnline(checked);
    setSavingStatus(true);
    try {
      await api.patch("/auth/me", { isOnline: checked });
      await refreshUser();
    } catch {
      setOnline(!checked);
      toast.error("Failed to update availability");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleThemeChange(next: "light" | "dark") {
    if (next === theme || savingTheme) return;

    const previous = theme;
    setTheme(next);
    setSavingTheme(true);

    const branding = effectiveWorkspaceBranding(user, company);
    applyWorkspaceBranding({
      primaryColor: branding?.primaryColor,
      theme: next,
    });

    try {
      await api.patch("/auth/me", { preferences: { theme: next } });
      await refreshUser();
    } catch {
      setTheme(previous);
      applyWorkspaceBranding({
        primaryColor: branding?.primaryColor,
        theme: previous,
      });
      toast.error("Failed to update appearance");
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  function updatePanelPosition() {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelWidth = 224;
    const gap = 8;
    const panelHeight = panelRef.current?.offsetHeight ?? 280;

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - gap) {
      left = window.innerWidth - panelWidth - gap;
    }
    left = Math.max(gap, left);

    let top = rect.top - panelHeight - gap;
    if (top < gap) {
      top = rect.bottom + gap;
    }

    setPanelStyle({
      position: "fixed",
      left,
      top,
      width: panelWidth,
      zIndex: 200,
    });
  }

  function toggleMenu() {
    setMenuOpen((open) => {
      const next = !open;
      if (next) {
        requestAnimationFrame(() => updatePanelPosition());
      }
      return next;
    });
  }

  const menuPanel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-3 py-3">
        <ProfileAvatar user={user} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">{online ? "Available" : "Offline"}</p>
        </div>
      </div>

      <Link
        href="/profile"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <UserRound className="size-4 shrink-0 text-muted-foreground" />
        Edit profile
      </Link>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm text-foreground">Available</span>
        <Switch
          checked={online}
          disabled={savingStatus}
          onCheckedChange={(checked) => void handleOnlineChange(checked)}
        />
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm text-foreground">Appearance</span>
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5"
          role="group"
          aria-label="Theme"
        >
          <button
            type="button"
            aria-label="Light mode"
            aria-pressed={theme === "light"}
            disabled={savingTheme}
            onClick={() => void handleThemeChange("light")}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              theme === "light"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Sun className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Dark mode"
            aria-pressed={theme === "dark"}
            disabled={savingTheme}
            onClick={() => void handleThemeChange("dark")}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              theme === "dark"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Moon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="h-px bg-border" />

      <a
        href={SITE_LEGAL.helpCenter}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <CircleHelp className="size-4 shrink-0 text-muted-foreground" />
        Help Center
      </a>

      <div className="h-px bg-border" />

      <button
        type="button"
        disabled={loggingOut}
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
      >
        <LogOut className="size-4 shrink-0" />
        {loggingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        aria-label="Open account menu"
        aria-expanded={menuOpen}
        onClick={toggleMenu}
        className={cn(
          "flex w-full items-center gap-3 rounded-[10px] px-1 py-1 text-left transition-colors hover:bg-muted/70",
          collapsed && "justify-center px-0 py-1",
          menuOpen && "bg-muted/50",
        )}
      >
        <ProfileAvatar user={user} online={online} />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {user?.email}
            </p>
          </div>
        ) : null}
      </button>

      {menuOpen && mounted ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}

export default function Sidebar({ embedded = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, company } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [assignedCount, setAssignedCount] = useState(0);
  const role = (user?.role ?? "customer") as Role;
  const isAgent = role === "agent";
  const isCollapsed = embedded ? false : collapsed;

  const branding = effectiveWorkspaceBranding(user, company);
  const logoSrc = resolveWorkspaceLogoSrc(branding, appearance);
  const collapsedSrc = branding?.favicon || logoSrc;

  useEffect(() => {
    const readAppearance = () => {
      const fromDom = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setAppearance(fromDom);
    };
    readAppearance();

    const observer = new MutationObserver(readAppearance);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isAgent) {
      setAssignedCount(0);
      return;
    }

    let cancelled = false;

    const loadAssigned = async () => {
      try {
        const { data } = await ticketApi.inboxCounts("inbox");
        const count = Number(data.data.counts?.assigned ?? 0);
        if (!cancelled) setAssignedCount(Number.isFinite(count) ? count : 0);
      } catch {
        if (!cancelled) setAssignedCount(0);
      }
    };

    void loadAssigned();
    const timer = window.setInterval(() => void loadAssigned(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAgent, pathname]);

  const primaryNav = PRIMARY_NAV.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-border/80 bg-card transition-[width] duration-200",
        embedded ? "flex w-full" : "hidden md:flex h-full shrink-0",
        !embedded && (isCollapsed ? "w-[68px]" : "w-[220px]"),
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border/60 px-3",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        <Link
          href="/dashboard"
          className={cn("inline-flex min-w-0 items-center", isCollapsed && "justify-center")}
        >
          {isCollapsed ? (
            collapsedSrc ? (
              <WorkspaceLogoImg
                src={collapsedSrc}
                alt={company?.name ?? "Workspace"}
                fallbackSrc="/icon.svg"
                className="size-8 rounded-lg object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/icon.svg" alt="Agentra" width={28} height={28} className="size-7 rounded-lg" />
            )
          ) : logoSrc ? (
            <WorkspaceLogoImg
              src={logoSrc}
              alt={company?.name ?? "Workspace"}
              fallbackSrc="/agentraa-logo.svg"
              className="object-contain"
              style={{
                maxWidth: company?.branding?.logoWidth ?? 148,
                maxHeight: company?.branding?.logoHeight ?? 28,
                width: "auto",
                height: "auto",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/agentraa-logo.svg" alt="Agentra" width={108} height={26} className="h-6 w-auto" />
          )}
        </Link>
        {!embedded && !isCollapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        ) : null}
      </div>

      {!embedded && isCollapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="size-3.5" />
        </button>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            role={role}
            pathname={pathname}
            collapsed={isCollapsed}
            badgeCount={isAgent && item.href === "/inbox" ? assignedCount : undefined}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/60 p-3">
        <SidebarAccountMenu collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
