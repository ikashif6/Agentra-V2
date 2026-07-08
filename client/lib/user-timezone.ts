import { Company, User } from "@/lib/types";

const PLACEHOLDER_TIMEZONES = new Set(["UTC", "Etc/UTC", "GMT"]);

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Prefer an explicit user/workspace timezone; ignore default UTC placeholders. */
export function getUserTimezone(user: User | null, company: Company | null): string {
  const userTz = user?.preferences?.timezone?.trim();
  if (userTz && !PLACEHOLDER_TIMEZONES.has(userTz)) return userTz;

  const companyTz = company?.timezone?.trim();
  if (companyTz && !PLACEHOLDER_TIMEZONES.has(companyTz)) return companyTz;

  return getBrowserTimezone();
}

export function getHourInTimezone(timezone: string, date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(date);

  return Number.parseInt(hour, 10);
}

export function getGreetingForTimezone(timezone: string, date = new Date()): string {
  const hour = getHourInTimezone(timezone, date);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatUserDateTime(
  timezone: string,
  date = new Date(),
  options?: {
    includeSeconds?: boolean;
    dateFormat?: "DMY" | "MDY";
    timeFormat?: "12h" | "24h";
  },
) {
  const dateFormat = options?.dateFormat ?? "MDY";
  const timeFormat = options?.timeFormat ?? "12h";

  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: options?.includeSeconds ? "2-digit" : undefined,
    hour12: timeFormat === "12h",
  }).format(date);

  const weekdayDate = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: "long",
    ...(dateFormat === "DMY"
      ? { day: "numeric", month: "long" }
      : { month: "long", day: "numeric" }),
  }).format(date);

  let zoneLabel = timezone;
  try {
    zoneLabel =
      new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        timeZoneName: "short",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? timezone;
  } catch {
    zoneLabel = timezone;
  }

  return { time, weekdayDate, zoneLabel };
}
