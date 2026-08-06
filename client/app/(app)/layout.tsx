"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CriticalAlertBanner from "@/components/layout/critical-alert-banner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const FULL_BLEED_ROUTES = ["/inbox", "/ai-agent", "/ai-agents", "/live-chat", "/settings"];
const FLAT_CANVAS_ROUTES = ["/dashboard", "/analytics"];

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFullBleed = FULL_BLEED_ROUTES.some((route) => pathname?.startsWith(route));
  const isFlatCanvas = FLAT_CANVAS_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname?.startsWith(route)),
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={cn(
        "app-shell relative flex h-screen flex-col overflow-hidden",
        isFlatCanvas && "app-shell-flat",
      )}
    >
      <CriticalAlertBanner />

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <Sidebar />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[220px] p-0">
            <Sidebar embedded />
          </SheetContent>
        </Sheet>

        {isFullBleed ? (
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2.5 pl-1.5 md:p-3 md:pl-2">
            <div className="app-shell-stage flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
              <Header onMenuClick={() => setMobileOpen(true)} />
              <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
            </div>
          </div>
        ) : (
          /*
           * Scroll lives on this outer column (not the white stage), so:
           * - scrollbar sits to the right of the canvas gutter
           * - header + panel scroll away together
           * Avoid display:flex here — flex height clamping traps overflow inside the stage.
           */
          <div className="relative z-[1] min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col p-2.5 pl-1.5 md:p-3 md:pl-2">
              <div className="app-shell-stage flex flex-1 flex-col overflow-hidden rounded-2xl">
                <Header onMenuClick={() => setMobileOpen(true)} />
                <main className="p-5 md:p-6">{children}</main>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="app-shell flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}
