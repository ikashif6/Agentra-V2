const User = require('../models/User');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getZonedParts(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekday = get('weekday')?.toLowerCase();
    const hour = get('hour');
    const minute = get('minute');
    return {
      dayKey: DAYS.find((d) => weekday?.startsWith(d.slice(0, 3))) || 'monday',
      time: `${hour}:${minute}`,
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
    };
  } catch {
    const day = date.getDay();
    const dayKey = DAYS[day];
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return {
      dayKey,
      time,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

/**
 * Build a UTC Date that corresponds to wall-clock HH:MM on the given zoned calendar day.
 */
function zonedWallClockToUtc(parts, hhmm, timeZone) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  const y = parts.year;
  const mo = parts.month;
  const d = parts.day;
  // Iterate to find UTC instant whose zoned wall-clock matches
  let guess = Date.UTC(y, mo - 1, d, h || 0, m || 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const z = getZonedParts(new Date(guess), timeZone);
    const wantMin = (h || 0) * 60 + (m || 0);
    const gotMin = Number(z.time.split(':')[0]) * 60 + Number(z.time.split(':')[1]);
    const dayDrift =
      Date.UTC(z.year, z.month - 1, z.day) - Date.UTC(y, mo - 1, d);
    guess -= dayDrift + (gotMin - wantMin) * 60 * 1000;
  }
  return new Date(guess);
}

function isWithinBusinessHours(company, atDate = new Date()) {
  const settings = company.settings?.businessHours;
  if (!settings?.enabled || !settings.schedule) {
    return true;
  }
  const tz = settings.timezone || company.timezone || 'UTC';
  const { dayKey, time } = getZonedParts(atDate, tz);
  const slot = settings.schedule[dayKey];
  if (!slot?.enabled) return false;
  return time >= slot.start && time < slot.end;
}

async function countOnlineLiveChatAgents(company) {
  const liveChatAgents = (company.liveChat?.agents || [])
    .map((id) => (id && id._id ? id._id : id))
    .filter(Boolean);

  const query = {
    company: company._id,
    role: { $in: ['agent', 'admin', 'owner'] },
    isActive: { $ne: false },
    isOnline: true,
    email: { $ne: 'bot@agentra.local' },
  };

  if (liveChatAgents.length) {
    query._id = { $in: liveChatAgents };
  }

  return User.countDocuments(query);
}

async function hasOnlineLiveChatAgents(company) {
  return (await countOnlineLiveChatAgents(company)) > 0;
}

async function isTeamAvailableNow(company) {
  if (company.liveChat?.enabled === false) return false;
  return hasOnlineLiveChatAgents(company);
}

/**
 * Next future opening strictly after fromDate.
 * Invariant: returned startsAt > fromDate (when startsAt is computable).
 */
function getNextBusinessOpening(company, fromDate = new Date()) {
  const settings = company.settings?.businessHours;
  if (!settings?.enabled || !settings.schedule) {
    return null;
  }
  const tz = settings.timezone || company.timezone || 'UTC';
  const from = fromDate instanceof Date ? fromDate : new Date(fromDate);

  for (let offset = 0; offset < 14; offset += 1) {
    const probe = new Date(from.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = getZonedParts(probe, tz);
    const slot = settings.schedule[parts.dayKey];
    if (!slot?.enabled || !slot.start) continue;

    const openingUtc = zonedWallClockToUtc(parts, slot.start, tz);
    // Skip openings that are not strictly in the future
    if (!(openingUtc.getTime() > from.getTime())) continue;

    const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : parts.dayKey;
    const tzLabel = tz === 'UTC' ? 'UTC' : tz.replace(/_/g, ' ');
    return {
      startsAt: openingUtc,
      dayKey: parts.dayKey,
      open: slot.start,
      displayText: `${label} at ${formatClock(slot.start, tz)} ${tzLabel}`,
      timezone: tz,
    };
  }
  return null;
}

function formatClock(hhmm, timeZone) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  const d = new Date(Date.UTC(2020, 0, 1, h || 9, m || 0, 0));
  try {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC', // hhmm is already wall-clock; render as-is
    });
  } catch {
    const hour12 = (h || 0) % 12 || 12;
    const ampm = (h || 0) >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  }
}

function formatNextOpeningForCustomer(company, fromDate = new Date()) {
  const next = getNextBusinessOpening(company, fromDate);
  if (!next) return null;
  // Guaranteed future by getNextBusinessOpening invariant
  return `Our support team will be available again ${next.displayText}.`;
}

function resolveSupportAvailability({
  liveSupportEnabled,
  withinHours,
  onlineAgentCount,
}) {
  let reason = 'available';
  if (!liveSupportEnabled) reason = 'live_support_disabled';
  else if (onlineAgentCount === 0 && !withinHours) reason = 'outside_business_hours';
  else if (onlineAgentCount === 0) reason = 'no_agents_online';

  return {
    isWithinBusinessHours: withinHours,
    liveSupportEnabled,
    availableAgentCount: liveSupportEnabled ? onlineAgentCount : 0,
    onlineAgentCount,
    // An explicitly online agent may accept a chat outside configured hours.
    queueOpen: liveSupportEnabled && onlineAgentCount > 0,
    estimatedWaitMinutes: onlineAgentCount > 0 ? Math.max(2, Math.ceil(4 / onlineAgentCount)) : null,
    reason,
  };
}

async function getSupportAvailability(company, atDate = new Date()) {
  const onlineAgentCount = await countOnlineLiveChatAgents(company);
  const withinHours = isWithinBusinessHours(company, atDate);
  const liveSupportEnabled = company.liveChat?.enabled !== false;
  const next = getNextBusinessOpening(company, atDate);
  return {
    ...resolveSupportAvailability({ liveSupportEnabled, withinHours, onlineAgentCount }),
    nextOpening: next,
    timezone: company.settings?.businessHours?.timezone || company.timezone || 'UTC',
  };
}

module.exports = {
  isTeamAvailableNow,
  isWithinBusinessHours,
  hasOnlineLiveChatAgents,
  countOnlineLiveChatAgents,
  getNextBusinessOpening,
  formatNextOpeningForCustomer,
  getSupportAvailability,
  resolveSupportAvailability,
  formatClock,
  getZonedParts,
  zonedWallClockToUtc,
};
