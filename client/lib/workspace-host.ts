const BASE_DOMAIN = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN ?? "agentraa.com";

// The app's public entry point (login / workspace discovery). The apex
// (agentraa.com) is reserved for the marketing site, so the app lives on
// `app.<base>` by default.
const PORTAL_HOST =
  process.env.NEXT_PUBLIC_APP_PORTAL_HOST ?? `app.${BASE_DOMAIN}`;

export const MAIN_LOGIN_URL = `https://${PORTAL_HOST}/auth/login`;

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
  "support",
  "help",
  "status",
  "blog",
  "docs",
  "portal",
]);

export const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeHostname(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function parseWorkspaceFromHostname(hostname: string): string | null {
  const host = normalizeHostname(hostname);

  if (host === "localhost" || host === "127.0.0.1") {
    return null;
  }

  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) {
      return null;
    }
    return sub;
  }

  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return null;
  }

  const suffix = `.${BASE_DOMAIN}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const sub = host.slice(0, -suffix.length);
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) {
    return null;
  }

  return sub;
}

export function getWorkspaceFromHostHeader(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  return parseWorkspaceFromHostname(hostHeader);
}

function isLocalDevHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

export function buildWorkspaceOrigin(subdomain: string): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : "";
    if (isLocalDevHost(window.location.hostname)) {
      return `${protocol}//${subdomain}.localhost${port || ":3000"}`;
    }
  }
  return `https://${subdomain}.${BASE_DOMAIN}`;
}

export function buildWorkspaceLoginUrl(subdomain: string): string {
  return `${buildWorkspaceOrigin(subdomain)}/auth/login`;
}

export function buildMainLoginUrl(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : "";
    if (isLocalDevHost(window.location.hostname)) {
      return `${protocol}//localhost${port}/auth/login`;
    }
  }
  return MAIN_LOGIN_URL;
}

export function getWorkspaceDisplayHost(subdomain: string): string {
  return `${subdomain}.${BASE_DOMAIN}`;
}

export function normalizeSubdomainInput(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidSubdomainFormat(subdomain: string): boolean {
  return SUBDOMAIN_REGEX.test(subdomain);
}

export function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function deriveSubdomainFromWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const hostname = new URL(normalizeWebsiteUrl(trimmed)).hostname.replace(/^www\./i, "");
    const label = hostname.split(".")[0] ?? "";
    return label.toLowerCase().replace(/[^a-z0-9-]/g, "");
  } catch {
    return normalizeSubdomainInput(trimmed).replace(/[^a-z0-9-]/g, "");
  }
}
