"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Company } from "@/lib/types";
import { authApi, workspaceApi } from "@/lib/api";
import { setTokens, clearTokens, setSubdomain, setUser, getUser, isAuthenticated } from "@/lib/auth";
import {
  applyWorkspaceBranding,
  cacheWorkspaceBranding,
  effectiveWorkspaceBranding,
  normalizeWorkspaceBranding,
  type WorkspaceBranding,
} from "@/lib/workspace-branding";

interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string, user: User, company: Company) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Update local user state without a full refresh / branding sync. */
  patchUser: (next: User | ((prev: User | null) => User | null)) => void;
  applyCompanyBranding: (branding: WorkspaceBranding) => void;
  syncWorkspaceBranding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = React.useRef<User | null>(null);
  userRef.current = user;

  const patchUser = useCallback((next: User | ((prev: User | null) => User | null)) => {
    setUserState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (resolved) setUser(resolved);
      return resolved;
    });
  }, []);

  const applyCompanyBranding = useCallback((branding: WorkspaceBranding) => {
    const normalized = normalizeWorkspaceBranding(branding);
    setCompany((prev) => {
      if (!prev) return prev;
      const nextCompany: Company = {
        ...prev,
        logo: normalized.logo ?? undefined,
        branding: {
          ...prev.branding,
          primaryColor: normalized.primaryColor,
          theme: normalized.theme,
          favicon: normalized.favicon,
          logoDark: normalized.logoDark,
          browserTitle: normalized.browserTitle,
          tagline: normalized.tagline,
          logoWidth: normalized.logoWidth,
          logoHeight: normalized.logoHeight,
        },
      };

      // Always honor the signed-in user's appearance preference over workspace default.
      const effective = effectiveWorkspaceBranding(userRef.current, nextCompany) ?? normalized;
      applyWorkspaceBranding(effective);
      cacheWorkspaceBranding(effective);
      return nextCompany;
    });
  }, []);

  const syncWorkspaceBranding = useCallback(async () => {
    try {
      const { data } = await workspaceApi.getBranding();
      const branding = normalizeWorkspaceBranding(data.data.branding);
      applyCompanyBranding(branding);
    } catch {
      // Branding sync is best-effort — auth remains usable without it.
    }
  }, [applyCompanyBranding]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      const u = data.data.user as User;
      setUserState(u);
      setUser(u);
      if (u.company && typeof u.company === "object") {
        setCompany(u.company as Company);
      }
      await syncWorkspaceBranding();
    } catch {
      clearTokens();
      setUserState(null);
      setCompany(null);
    }
  }, [syncWorkspaceBranding]);

  useEffect(() => {
    const init = async () => {
      const onAuthPage =
        typeof window !== "undefined" && window.location.pathname.startsWith("/auth/");

      if (isAuthenticated() && !onAuthPage) {
        // Try cached user first for instant render
        const cached = getUser();
        if (cached) {
          setUserState(cached);
          if (cached.company && typeof cached.company === "object") {
            setCompany(cached.company as Company);
          }
        }
        await refreshUser();
      }
      setLoading(false);
    };
    init();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;

    const onFocus = () => {
      void syncWorkspaceBranding();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, syncWorkspaceBranding]);

  const login = (accessToken: string, refreshToken: string, u: User, c: Company) => {
    setTokens(accessToken, refreshToken);
    setSubdomain(c.subdomain);
    setUser(u);
    setUserState(u);
    setCompany(c);
    void syncWorkspaceBranding();
  };

  const logout = async () => {
    try {
      const { default: Cookies } = await import("js-cookie");
      const refreshToken = Cookies.get("refreshToken");
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    clearTokens();
    setUserState(null);
    setCompany(null);
    window.location.href = "/auth/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        loading,
        login,
        logout,
        refreshUser,
        patchUser,
        applyCompanyBranding,
        syncWorkspaceBranding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
