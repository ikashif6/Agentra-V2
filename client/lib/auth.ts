import Cookies from "js-cookie";
import { User } from "./types";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "agentraa.com";

/** Share auth across workspace subdomains + app portal (needed for Paddle checkout). */
function authCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname.toLowerCase();
  if (host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`)) {
    return `.${BASE_DOMAIN}`;
  }
  return undefined;
}

function accessCookieOpts() {
  const domain = authCookieDomain();
  return {
    expires: 7,
    sameSite: "lax" as const,
    ...(domain ? { domain, secure: true } : {}),
  };
}

function refreshCookieOpts() {
  const domain = authCookieDomain();
  return {
    expires: 30,
    sameSite: "lax" as const,
    ...(domain ? { domain, secure: true } : {}),
  };
}

export function setTokens(accessToken: string, refreshToken: string) {
  Cookies.set("accessToken", accessToken, accessCookieOpts());
  Cookies.set("refreshToken", refreshToken, refreshCookieOpts());
}

/**
 * Re-write host-only cookies onto the parent domain so
 * demo.agentraa.com → app.agentraa.com checkout keeps the session.
 */
export function mirrorAuthCookiesToParentDomain() {
  const domain = authCookieDomain();
  if (!domain) return;

  const accessToken = Cookies.get("accessToken");
  const refreshToken = Cookies.get("refreshToken");
  const subdomain = Cookies.get("subdomain");
  const user = Cookies.get("user");

  if (accessToken) Cookies.set("accessToken", accessToken, accessCookieOpts());
  if (refreshToken) Cookies.set("refreshToken", refreshToken, refreshCookieOpts());
  if (subdomain) Cookies.set("subdomain", subdomain, refreshCookieOpts());
  if (user) Cookies.set("user", user, accessCookieOpts());
}

export function clearTokens() {
  const domain = authCookieDomain();
  const names = ["accessToken", "refreshToken", "subdomain", "user"] as const;
  for (const name of names) {
    Cookies.remove(name);
    if (domain) Cookies.remove(name, { domain });
  }
}

export function getAccessToken() {
  return Cookies.get("accessToken");
}

export function setSubdomain(subdomain: string) {
  Cookies.set("subdomain", subdomain, refreshCookieOpts());
}

export function getSubdomain() {
  return Cookies.get("subdomain");
}

export function setUser(user: User) {
  Cookies.set("user", JSON.stringify(user), accessCookieOpts());
}

export function getUser(): User | null {
  try {
    const raw = Cookies.get("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!Cookies.get("accessToken");
}

export function setTrackToken(token: string) {
  sessionStorage.setItem("trackToken", token);
}

export function getTrackToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("trackToken");
}

export function clearTrackToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem("trackToken");
}
