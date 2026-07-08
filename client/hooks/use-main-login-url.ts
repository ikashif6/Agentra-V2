"use client";

import { useEffect, useState } from "react";
import { buildMainLoginUrl, MAIN_LOGIN_URL } from "@/lib/workspace-host";

// SSR-safe default (no `window`) so the server and first client render agree.
const SSR_MAIN_LOGIN_URL = MAIN_LOGIN_URL;

/**
 * Returns the "sign in to a different workspace" URL without causing a
 * hydration mismatch. `buildMainLoginUrl()` depends on `window.location`
 * (e.g. localhost during dev), which differs from the server-rendered value,
 * so we start from the deterministic production URL and refine after mount.
 */
export function useMainLoginUrl(): string {
  const [url, setUrl] = useState(SSR_MAIN_LOGIN_URL);

  useEffect(() => {
    setUrl(buildMainLoginUrl());
  }, []);

  return url;
}
