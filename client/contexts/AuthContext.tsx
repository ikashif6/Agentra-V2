"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Company } from "@/lib/types";
import { authApi } from "@/lib/api";
import { setTokens, clearTokens, setSubdomain, setUser, getUser, isAuthenticated } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string, user: User, company: Company) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      const u = data.data.user as User;
      setUserState(u);
      setUser(u);
      if (u.company && typeof u.company === "object") {
        setCompany(u.company as Company);
      }
    } catch {
      clearTokens();
      setUserState(null);
      setCompany(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated()) {
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

  const login = (accessToken: string, refreshToken: string, u: User, c: Company) => {
    setTokens(accessToken, refreshToken);
    setSubdomain(c.subdomain);
    setUser(u);
    setUserState(u);
    setCompany(c);
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
    <AuthContext.Provider value={{ user, company, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
