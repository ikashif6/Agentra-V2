"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "agentra:home-setup-deferred";

export function useHomeSetupDefer() {
  const [deferred, setDeferredState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDeferredState(window.localStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  const setDeferred = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setDeferredState(true);
  }, []);

  return { deferred, setDeferred, ready };
}
