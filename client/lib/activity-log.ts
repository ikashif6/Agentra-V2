export type ActivityLogEntry = {
  _id: string;
  event: string;
  eventLabel: string;
  objectType?: string;
  objectId?: string;
  objectLabel?: string;
  actorEmail?: string;
  actorName?: string;
  actor?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  } | null;
  createdAt: string;
};

export type ActivityEventOption = {
  id: string;
  label: string;
};

export type ActivityLogResponse = {
  logs: ActivityLogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  events: ActivityEventOption[];
};

export type ActivityDateRange = "today" | "7d" | "30d" | "all";

export function getDateRangeBounds(range: ActivityDateRange): { from?: string; to?: string } {
  if (range === "all") return {};

  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export function formatActivityDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function activityActorLabel(entry: ActivityLogEntry) {
  if (entry.actor?.email) return entry.actor.email;
  if (entry.actorEmail) return entry.actorEmail;
  return "System";
}

export function activityActorInitial(entry: ActivityLogEntry) {
  const email = entry.actor?.email || entry.actorEmail;
  if (email) return email[0]?.toUpperCase() || "?";
  const name = entry.actorName || "";
  if (name) return name[0]?.toUpperCase() || "?";
  return "S";
}

export const DATE_RANGE_OPTIONS: { id: ActivityDateRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];
