import { env } from "../config/env.js";
import { getWorkspaceConfig } from "../workspace/index.js";

export interface BusinessHoursStatus {
  open: boolean;
  summary: string;
  localTime: string;
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function getBusinessHoursStatus(now = new Date()): BusinessHoursStatus {
  const config = getWorkspaceConfig(env.workspaceId);
  const tz = config.businessHours?.timezone || env.businessHoursTz;
  const days = config.businessHours?.days?.length
    ? config.businessHours.days
    : env.businessHoursDays;
  const startHm = config.businessHours?.start || env.businessHoursStart;
  const endHm = config.businessHours?.end || env.businessHoursEnd;

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(now).map((p) => [p.type, p.value]),
    );
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const day = weekdayMap[parts.weekday] ?? now.getDay();
    const minutes = parseHm(`${parts.hour}:${parts.minute}`);
    const start = parseHm(startHm);
    const end = parseHm(endHm);
    const dayOk = days.includes(day);
    const open = dayOk && minutes >= start && minutes < end;
    const dayLabels = days
      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
      .join(", ");
    return {
      open,
      localTime: `${parts.weekday} ${parts.hour}:${parts.minute} (${tz})`,
      summary: `${dayLabels} ${startHm}–${endHm} ${tz}`,
    };
  } catch {
    return {
      open: true,
      localTime: now.toISOString(),
      summary: "Business hours unavailable; assuming open",
    };
  }
}

export function areAgentsOnline(): boolean {
  const config = getWorkspaceConfig(env.workspaceId);
  const hours = getBusinessHoursStatus();
  const available =
    config.businessHours?.agentsAvailable ?? env.agentsAvailable;
  return Boolean(available) && hours.open;
}
