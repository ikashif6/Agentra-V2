"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  readCachedWorkspaceBranding,
  effectiveWorkspaceBranding,
  DEFAULT_PRIMARY_COLOR,
} from "@/lib/workspace-branding";

export default function WorkspaceThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, company } = useAuth();

  useEffect(() => {
    const cached = readCachedWorkspaceBranding();
    if (cached) applyWorkspaceBranding(cached);
  }, []);

  useEffect(() => {
    const branding = effectiveWorkspaceBranding(user, company);
    if (!branding) return;
    applyWorkspaceBranding(branding);

    if (company) {
      cacheWorkspaceBranding({
        logo: company.logo ?? null,
        primaryColor: company.branding?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
        theme: company.branding?.theme ?? "light",
      });
    }
  }, [user, company]);

  useEffect(() => {
    const branding = effectiveWorkspaceBranding(user, company);
    if (!branding || branding.theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyWorkspaceBranding(branding);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [user, company]);

  return children;
}
