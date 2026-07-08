"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatUserDateTime,
  getGreetingForTimezone,
  getUserTimezone,
} from "@/lib/user-timezone";

export function useUserLocalTime() {
  const { user, company } = useAuth();
  const timezone = useMemo(() => getUserTimezone(user, company), [user, company]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const { time, weekdayDate, zoneLabel } = formatUserDateTime(timezone, now, {
    dateFormat: user?.preferences?.dateFormat,
    timeFormat: user?.preferences?.timeFormat,
  });
  const greeting = getGreetingForTimezone(timezone, now);

  return {
    timezone,
    time,
    weekdayDate,
    zoneLabel,
    greeting,
  };
}
