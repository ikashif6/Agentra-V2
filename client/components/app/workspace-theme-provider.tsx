"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  readCachedWorkspaceBranding,
  effectiveWorkspaceBranding,
} from "@/lib/workspace-branding";

export default function WorkspaceThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, company, syncWorkspaceBranding } = useAuth();

  useEffect(() => {
    const cached = readCachedWorkspaceBranding();
    if (cached) applyWorkspaceBranding(cached);
    else applyWorkspaceBranding({ theme: "light" });
  }, []);

  useEffect(() => {
    const branding = effectiveWorkspaceBranding(user, company);
    if (!branding) return;
    applyWorkspaceBranding(branding);
    cacheWorkspaceBranding(branding);
  }, [user, company, pathname]);

  useEffect(() => {
    if (!user) return;
    void syncWorkspaceBranding();
  }, [user?._id, syncWorkspaceBranding]);

  return children;
}
