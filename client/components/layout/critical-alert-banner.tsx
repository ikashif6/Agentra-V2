"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  dismissCriticalAlert,
  getCriticalAlerts,
  isCriticalAlertDismissed,
  type CriticalAlert,
} from "@/lib/critical-alerts";
import { cn } from "@/lib/utils";

export default function CriticalAlertBanner() {
  const { user, company } = useAuth();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const alerts = useMemo(() => getCriticalAlerts(user, company), [user, company]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const alert of alerts) {
      next[alert.id] = isCriticalAlertDismissed(alert.id);
    }
    setDismissed(next);
  }, [alerts]);

  const visible = alerts.filter((alert) => !dismissed[alert.id]);
  const alert = visible[0] as CriticalAlert | undefined;
  if (!alert) return null;

  return (
    <div
      role="alert"
      className={cn(
        "relative z-50 flex w-full shrink-0 items-start gap-3 border-b border-border/80 bg-background px-4 py-2.5",
        "sm:items-center sm:px-5",
      )}
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground sm:mt-0">
        <AlertCircle className="size-3.5" strokeWidth={2.5} />
      </span>

      <p className="min-w-0 flex-1 text-sm leading-snug text-foreground">
        {alert.message}
        {alert.ctaLabel ? (
          <>
            {" "}
            {alert.ctaHref ? (
              <Link
                href={alert.ctaHref}
                className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
              >
                {alert.ctaLabel}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{alert.ctaLabel}</span>
            )}
          </>
        ) : null}
      </p>

      <button
        type="button"
        aria-label="Dismiss alert"
        onClick={() => {
          dismissCriticalAlert(alert.id);
          setDismissed((prev) => ({ ...prev, [alert.id]: true }));
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
