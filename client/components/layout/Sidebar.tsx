"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Role, User } from "@/lib/types";
import { PRIMARY_NAV, isNavActive, type AppNavItem } from "@/lib/app-navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WorkspaceChromeActions } from "@/components/layout/workspace-chrome-actions";
import { Switch } from "@/components/ui/switch";
import { api, ticketApi } from "@/lib/api";
import { WorkspaceLogoImg } from "@/components/app/workspace-logo-img";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
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
        "group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[14px] font-[450] tracking-[-0.01em] transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]",
        collapsed && "justify-center px-2",
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className={cn(
            "size-[18px]",
            active
              ? "text-primary opacity-80"
              : "text-muted-foreground/80 group-hover:text-foreground",
          )}
          strokeWidth={1.75}
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
            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
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

function SidebarAccountMenu() {
  const { user, company, logout, patchUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [online, setOnline] = useState(user?.isOnline ?? true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const themeLockRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      const { data } = await api.patch("/auth/me", { isOnline: checked });
      const updated = data.data?.user as User | undefined;
      if (updated) patchUser(updated);
    } catch {
      setOnline(!checked);
      toast.error("Failed to update availability");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleThemeChange(next: "light" | "dark") {
    if (next === theme || themeLockRef.current) return;

    const previous = theme;
    themeLockRef.current = true;
    setTheme(next);

    const optimisticUser = {
      ...(user ?? ({} as User)),
      preferences: {
        ...(user?.preferences ?? {}),
        theme: next,
      },
    } as User;

    const branding = effectiveWorkspaceBranding(optimisticUser, company);
    if (branding) {
      applyWorkspaceBranding(branding);
      cacheWorkspaceBranding(branding);
    }

    patchUser((prev) =>
      prev
        ? {
            ...prev,
            preferences: {
              ...(prev.preferences ?? {}),
              theme: next,
            },
          }
        : prev,
    );

    try {
      const { data } = await api.patch("/auth/me", { preferences: { theme: next } });
      const updated = data.data?.user as User | undefined;
      if (updated) patchUser(updated);
    } catch {
      setTheme(previous);
      patchUser((prev) =>
        prev
          ? {
              ...prev,
              preferences: {
                ...(prev.preferences ?? {}),
                theme: previous,
              },
            }
          : prev,
      );
      const reverted = effectiveWorkspaceBranding(
        {
          preferences: {
            ...(user?.preferences ?? {}),
            theme: previous,
          },
        },
        company,
      );
      if (reverted) {
        applyWorkspaceBranding(reverted);
        cacheWorkspaceBranding(reverted);
      }
      toast.error("Failed to update appearance");
    } finally {
      themeLockRef.current = false;
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
    const gap = 10;
    const panelHeight = panelRef.current?.offsetHeight ?? 360;

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

  const displayName =
    [namePart(user?.firstName), namePart(user?.lastName)].filter(Boolean).join(" ") ||
    (user?.fullName || "").trim().replace(/\s+-\s*$/, "") ||
    "Account";

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-foreground transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

  const menuPanel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-xl border border-black/[0.06] bg-card shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-2.5">
        <ProfileAvatar user={user} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {displayName}
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="h-px bg-black/[0.06] dark:bg-white/10" />

      <div className="space-y-0.5 px-1.5 py-1">
        <Link href="/profile" onClick={() => setMenuOpen(false)} className={menuItemClass}>
          <UserRound className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          Profile
        </Link>
        <Link href="/settings" onClick={() => setMenuOpen(false)} className={menuItemClass}>
          <Settings className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          Settings
        </Link>
      </div>

      <div className="h-px bg-black/[0.06] dark:bg-white/10" />

      <div className="space-y-0.5 px-1.5 py-1">
        <div className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5">
          <span className="text-[13px] text-foreground">Available</span>
          <Switch
            checked={online}
            disabled={savingStatus}
            onCheckedChange={(checked) => void handleOnlineChange(checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5">
          <span className="text-[13px] text-foreground">Appearance</span>
          <div
            className="flex items-center gap-0.5 rounded-lg border border-black/[0.08] bg-muted/40 p-0.5 dark:border-white/10"
            role="group"
            aria-label="Theme"
          >
            <button
              type="button"
              aria-label="Light mode"
              aria-pressed={theme === "light"}
              onClick={() => void handleThemeChange("light")}
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                theme === "light"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Sun className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Dark mode"
              aria-pressed={theme === "dark"}
              onClick={() => void handleThemeChange("dark")}
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                theme === "dark"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Moon className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-black/[0.06] dark:bg-white/10" />

      <div className="px-1.5 py-1">
        <a
          href={SITE_LEGAL.helpCenter}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMenuOpen(false)}
          className={menuItemClass}
        >
          <CircleHelp className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          Support
        </a>
      </div>

      <div className="h-px bg-black/[0.06] dark:bg-white/10" />

      <div className="px-1.5 py-1 pb-2.5">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          className={cn(menuItemClass, "disabled:opacity-50")}
        >
          <LogOut className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
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
          "flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05]",
          menuOpen && "bg-black/[0.05]",
        )}
      >
        <ProfileAvatar user={user} online={online} />
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
        "flex h-full min-h-0 flex-col transition-[width] duration-200",
        embedded
          ? "flex w-full border-r border-sidebar-border bg-sidebar"
          : "hidden h-full shrink-0 bg-transparent md:flex",
        !embedded && (isCollapsed ? "w-[68px]" : "w-[220px]"),
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center px-3",
          embedded && "border-b border-border/60",
          isCollapsed ? "justify-center px-2" : "justify-between",
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
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {!embedded && isCollapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-1.5 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-1.5">
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

      <div
        className={cn(
          "flex shrink-0 items-center px-2 pb-3 pt-2",
          isCollapsed ? "flex-col gap-1" : "justify-between gap-2",
        )}
      >
        <SidebarAccountMenu />
        <WorkspaceChromeActions collapsed={isCollapsed} />
      </div>
    </aside>
  );
}
