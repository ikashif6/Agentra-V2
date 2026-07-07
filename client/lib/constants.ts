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
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-brand-muted text-brand-muted-foreground",
  on_hold: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  self_closed: "bg-gray-100 text-gray-600",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-brand-muted text-brand-muted-foreground",
  urgent: "bg-red-100 text-red-700",
};
