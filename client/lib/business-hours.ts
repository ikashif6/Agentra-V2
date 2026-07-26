export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type DaySchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WeeklySchedule = Record<Weekday, DaySchedule>;

export type BusinessHoursDefault = {
  enabled: boolean;
  timezone: string;
  schedule: WeeklySchedule | null;
};

export type CustomBusinessHours = {
  id: string;
  name: string;
  targets: string[];
  timezone: string;
  schedule: WeeklySchedule;
};

export type BusinessHoursConfig = {
  default: BusinessHoursDefault;
  custom: CustomBusinessHours[];
};

export const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "17:00" },
  sunday: { enabled: false, start: "09:00", end: "17:00" },
};

export const BUSINESS_HOURS_TARGETS = [
  { id: "email", label: "Email" },
  { id: "chat", label: "Live chat" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
] as const;

export function cloneWeeklySchedule(schedule: WeeklySchedule = DEFAULT_WEEKLY_SCHEDULE): WeeklySchedule {
  return normalizeWeeklySchedule(JSON.parse(JSON.stringify(schedule)) as WeeklySchedule);
}

/** Ensure HH:mm 24-hour values for native time inputs. */
export function normalizeTimeValue(value: string): string {
  if (!value) return "09:00";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeWeeklySchedule(schedule: WeeklySchedule): WeeklySchedule {
  const normalized = { ...schedule };
  for (const day of WEEKDAYS) {
    const slot = normalized[day] ?? DEFAULT_WEEKLY_SCHEDULE[day];
    normalized[day] = {
      enabled: Boolean(slot.enabled),
      start: normalizeTimeValue(slot.start ?? DEFAULT_WEEKLY_SCHEDULE[day].start),
      end: normalizeTimeValue(slot.end ?? DEFAULT_WEEKLY_SCHEDULE[day].end),
    };
  }
  return normalized;
}

export function formatTimeLabel(time24: string, use12h = true): string {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time24;

  if (!use12h) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

type ScheduleSegment = {
  dayLabel: string;
  start: string;
  end: string;
};

function buildScheduleSegments(schedule: WeeklySchedule): ScheduleSegment[] {
  const segments: ScheduleSegment[] = [];
  let index = 0;

  while (index < WEEKDAYS.length) {
    const day = WEEKDAYS[index];
    const slot = schedule[day];
    if (!slot?.enabled) {
      index += 1;
      continue;
    }

    const startIndex = index;
    const { start, end } = slot;
    index += 1;

    while (index < WEEKDAYS.length) {
      const nextDay = WEEKDAYS[index];
      const nextSlot = schedule[nextDay];
      if (!nextSlot?.enabled || nextSlot.start !== start || nextSlot.end !== end) break;
      index += 1;
    }

    const endIndex = index - 1;
    const dayLabel =
      startIndex === endIndex
        ? DAY_SHORT[WEEKDAYS[startIndex]]
        : `${DAY_SHORT[WEEKDAYS[startIndex]]}-${DAY_SHORT[WEEKDAYS[endIndex]]}`;

    segments.push({ dayLabel, start, end });
  }

  return segments;
}

export function formatScheduleSummary(
  schedule: WeeklySchedule | null | undefined,
  options?: { use12h?: boolean },
): string {
  if (!schedule) return "No hours configured";

  const segments = buildScheduleSegments(schedule);
  if (segments.length === 0) return "No hours configured";

  const use12h = options?.use12h !== false;
  return segments
    .map(
      (segment) =>
        `${segment.dayLabel}, ${formatTimeLabel(segment.start, use12h)} to ${formatTimeLabel(segment.end, use12h)}`,
    )
    .join(", ");
}

export function formatTargetLabels(targets: string[]): string {
  if (!targets.length) return "All channels";
  return targets
    .map((id) => BUSINESS_HOURS_TARGETS.find((t) => t.id === id)?.label ?? id)
    .join(", ");
}

export function getTimezoneOptions(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
        "timeZone",
      );
    }
  } catch {
    /* fall through */
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
}
