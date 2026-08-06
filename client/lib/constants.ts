export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
/** Production API for Meta OAuth when local API cannot sign the callback state. */
export const FACEBOOK_API_BASE =
  process.env.NEXT_PUBLIC_FACEBOOK_API_URL ?? API_BASE;
export const APP_NAME = "Agentra";

export const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  on_hold: "On Hold",
  resolved: "Resolved",
  closed: "Closed",
  self_closed: "Self Closed",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
  urgent: "Critical",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  in_progress: "bg-brand-muted text-brand-muted-foreground",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  resolved: "bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  self_closed: "bg-muted text-muted-foreground",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  high: "bg-brand-muted text-brand-muted-foreground",
  urgent: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};
