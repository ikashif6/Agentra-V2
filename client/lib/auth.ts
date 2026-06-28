import Cookies from "js-cookie";
import { User } from "./types";

const COOKIE_OPTS = { expires: 7, sameSite: "lax" as const };
const REFRESH_OPTS = { expires: 30, sameSite: "lax" as const };

export function setTokens(accessToken: string, refreshToken: string) {
  Cookies.set("accessToken", accessToken, COOKIE_OPTS);
  Cookies.set("refreshToken", refreshToken, REFRESH_OPTS);
}

export function clearTokens() {
  Cookies.remove("accessToken");
  Cookies.remove("refreshToken");
  Cookies.remove("subdomain");
  Cookies.remove("user");
}

export function getAccessToken() {
  return Cookies.get("accessToken");
}

export function setSubdomain(subdomain: string) {
  Cookies.set("subdomain", subdomain, { expires: 30, sameSite: "lax" });
}

export function getSubdomain() {
  return Cookies.get("subdomain");
}

export function setUser(user: User) {
  Cookies.set("user", JSON.stringify(user), COOKIE_OPTS);
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
