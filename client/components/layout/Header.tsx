"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, HelpCircle, Settings, LogOut, ChevronDown, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/departments": "Departments",
  "/teams":       "Teams",
  "/agents":      "Agents",
  "/tickets":     "Tickets",
  "/settings":    "Settings",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const title = Object.entries(PAGE_TITLES).find(
    ([key]) => pathname === key || pathname.startsWith(key + "/")
  )?.[1] ?? "Agentraa";
  const displayTitle = title === "Tickets" && user?.role === "customer" ? "My Tickets" : title;

  return (
    <header className="h-16 border-b border-gray-100 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-none">{displayTitle}</h1>
          <p className="text-xs text-gray-400 hidden sm:block mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell className="h-5 w-5 text-gray-500" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full border-2 border-white bg-primary" />
        </button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-xs font-bold bg-primary text-primary-foreground"
                >
                  {initials(user?.fullName ?? user?.firstName ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-400 capitalize leading-tight">{user?.role}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden">
            {/* Profile card inside dropdown */}
            <DropdownMenuLabel className="p-0">
              <div className="px-4 py-4 flex items-center gap-3"
                style={{ background: "linear-gradient(135deg,#D85A30,#B84A28)" }}>
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarFallback className="text-sm font-bold bg-white/20 text-white">
                    {initials(user?.fullName ?? user?.firstName ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-white/70 text-xs truncate">{user?.email}</p>
                  <span className="inline-block mt-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="my-0" />

            <div className="p-1.5 space-y-0.5">
              <DropdownMenuItem
                onClick={() => (window.location.href = "/settings")}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">Settings</span>
              </DropdownMenuItem>

              {/* Help Center — setup link for owners/admins, public portal otherwise */}
              {["owner", "admin"].includes(user?.role ?? "") ? (
                <DropdownMenuItem
                  onClick={() => (window.location.href = "/settings?tab=helpcenter")}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Help center setup</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      `/helpcenter?workspace=${user?.company && typeof user.company === "object"
                        ? (user.company as { subdomain?: string }).subdomain ?? ""
                        : ""}`,
                      "_blank"
                    )
                  }
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Help center</span>
                  <ExternalLink className="h-3 w-3 text-gray-300 ml-auto" />
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={logout}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sign out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
