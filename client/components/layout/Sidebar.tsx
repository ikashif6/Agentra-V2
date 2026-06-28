"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket, Building2, Users, Settings,
  LogOut, UserCircle2, ChevronLeft, ChevronRight, UserPlus, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  customerLabel?: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",   icon: <LayoutDashboard className="h-[18px] w-[18px]" />, roles: ["owner","admin","agent","customer"] },
  { label: "Departments", href: "/departments", icon: <Building2 className="h-[18px] w-[18px]" />,       roles: ["owner","admin","agent"] },
  { label: "Teams",       href: "/teams",       icon: <Users className="h-[18px] w-[18px]" />,            roles: ["owner","admin","agent"] },
  { label: "Agents",      href: "/agents",      icon: <UserPlus className="h-[18px] w-[18px]" />,         roles: ["owner","admin"] },
  {
    label: "Tickets", href: "/tickets",
    icon: <Ticket className="h-[18px] w-[18px]" />,
    roles: ["owner","admin","agent","customer"],
    customerLabel: "My Tickets",
  },
  { label: "Help Center", href: "/settings?tab=helpcenter", icon: <HelpCircle className="h-[18px] w-[18px]" />, roles: ["owner","admin"] },
  { label: "Settings",    href: "/settings",    icon: <Settings className="h-[18px] w-[18px]" />,         roles: ["owner","admin","agent","customer"] },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const PLAN_BADGE: Record<string, string> = {
  starter:    "bg-blue-500/20 text-blue-200",
  pro:        "bg-purple-500/20 text-purple-200",
  enterprise: "bg-amber-500/20 text-amber-200",
  free:       "bg-white/10 text-white/50",
};

export default function Sidebar() {
  const pathname   = usePathname();
  const { user, company, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const role       = (user?.role ?? "customer") as Role;
  const visibleNav = NAV.filter((item) => item.roles.includes(role));

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200 overflow-hidden",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
      style={{ background: "linear-gradient(160deg, #1a0a04 0%, #2d1208 40%, #D85A30 100%)" }}
    >
      {/* ── Branding ─────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center h-16 px-4 shrink-0 border-b border-white/10",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Agentraa</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all shrink-0",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* ── Company card ─────────────────────────────────────── */}
      {!collapsed && company && (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">{company.name}</p>
              <p className="text-white/50 text-xs truncate">{company.subdomain}.agentraa.com</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
              PLAN_BADGE[company.plan?.name ?? "free"]
            )}>
              {company.plan?.name ?? "free"}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full capitalize",
              company.plan?.status === "trialing" ? "bg-yellow-500/20 text-yellow-200" : "bg-green-500/20 text-green-200"
            )}>
              {company.plan?.status}
            </span>
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const label  = role === "customer" && item.customerLabel ? item.customerLabel : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-white text-[#D85A30] shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center"
              )}
            >
              <span className={cn("shrink-0", active ? "text-[#D85A30]" : "text-white/60")}>
                {item.icon}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Profile card ─────────────────────────────────────── */}
      <div className={cn(
        "shrink-0 border-t border-white/10",
        collapsed ? "p-2 flex flex-col items-center gap-2" : "p-3"
      )}>
        {!collapsed ? (
          <div className="bg-white/10 rounded-xl p-3 space-y-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                  {initials(user?.fullName ?? user?.firstName ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-white/50 text-xs truncate">{user?.email}</p>
              </div>
            </div>
            {/* Role badge */}
            <Badge className="bg-white/10 text-white/70 border-white/10 text-xs capitalize w-full justify-center">
              {user?.role}
            </Badge>
            {/* Actions */}
            <div className="grid grid-cols-2 gap-1.5">
              <Link
                href="/settings"
                className="flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg py-2 transition-all"
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                Profile
              </Link>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1.5 text-xs text-red-300/70 hover:text-red-200 bg-white/5 hover:bg-red-500/20 rounded-lg py-2 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                {initials(user?.fullName ?? user?.firstName ?? "?")}
              </AvatarFallback>
            </Avatar>
            <button onClick={logout} className="p-1.5 rounded-lg text-red-300/70 hover:text-red-200 hover:bg-red-500/20 transition-all">
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
