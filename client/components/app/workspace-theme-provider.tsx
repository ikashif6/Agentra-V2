"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  readCachedWorkspaceBranding,
  effectiveWorkspaceBranding,
  normalizeWorkspaceBranding,
} from "@/lib/workspace-branding";

export default function WorkspaceThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, company, syncWorkspaceBranding } = useAuth();

  useEffect(() => {
    const cached = readCachedWorkspaceBranding();
    if (cached) applyWorkspaceBranding(cached);
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

  useEffect(() => {
    const branding = effectiveWorkspaceBranding(user, company);
    if (!branding || branding.theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyWorkspaceBranding(normalizeWorkspaceBranding(branding));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [user, company]);

  return children;
}
