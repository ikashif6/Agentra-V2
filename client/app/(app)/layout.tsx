"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className={cn("app-shell relative flex h-screen overflow-hidden", isFlatCanvas && "app-shell-flat")}>
      {!isFlatCanvas ? (
        <div className="app-shell-grid pointer-events-none absolute inset-0" aria-hidden />
      ) : null}

      <Sidebar />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[220px] p-0">
          <Sidebar embedded />
        </SheetContent>
      </Sheet>

      <div className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main
          className={cn(
            isFullBleed ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-4 md:p-6",
            isFlatCanvas && "bg-background",
          )}
        >
          {children}
        </main>
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
