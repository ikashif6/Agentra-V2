const User = require('../models/User');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getZonedParts(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    return {
      dayKey: DAYS.find((d) => weekday?.startsWith(d.slice(0, 3))) || 'monday',
      time: `${hour}:${minute}`,
    };
  } catch {
    const day = date.getDay();
    const dayKey = DAYS[day];
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return { dayKey, time };
  }
}

function isWithinBusinessHours(company) {
  const settings = company.settings?.businessHours;
  if (!settings?.enabled || !settings.schedule) {
    // Hours not configured → do not block on schedule alone
    return true;
  }
  const tz = settings.timezone || company.timezone || 'UTC';
  const now = new Date();
  const { dayKey, time } = getZonedParts(now, tz);
  const slot = settings.schedule[dayKey];
  if (!slot?.enabled) return false;
  return time >= slot.start && time < slot.end;
}

/**
 * Count staff who are marked online (sidebar toggle / login presence).
 * Prefers company.liveChat.agents when that list is set.
 */
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

/**
 * Team is available for live handoff only when at least one agent is online
 * AND (if business hours are enabled) we are inside those hours.
 */
async function isTeamAvailableNow(company) {
  const online = await hasOnlineLiveChatAgents(company);
  if (!online) return false;
  return isWithinBusinessHours(company);
}

function getNextBusinessOpening(company, fromDate = new Date()) {
  const settings = company.settings?.businessHours;
  if (!settings?.enabled || !settings.schedule) {
    return null;
  }
  const tz = settings.timezone || company.timezone || 'UTC';
  for (let offset = 0; offset < 14; offset += 1) {
    const probe = new Date(fromDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const { dayKey, time } = getZonedParts(probe, tz);
    const slot = settings.schedule[dayKey];
    if (!slot?.enabled || !slot.start) continue;
    if (offset === 0 && time >= slot.start && time < (slot.end || '23:59')) {
      return null; // currently open
    }
    if (offset === 0 && time < slot.start) {
      return {
        startsAt: null,
        dayKey,
        open: slot.start,
        displayText: `today at ${formatClock(slot.start)}`,
        timezone: tz,
      };
    }
    if (offset > 0) {
      const label = offset === 1 ? 'tomorrow' : dayKey;
      return {
        startsAt: null,
        dayKey,
        open: slot.start,
        displayText: `${label} at ${formatClock(slot.start)}`,
        timezone: tz,
      };
    }
  }
  return null;
}

function formatClock(hhmm) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 9, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatNextOpeningForCustomer(company) {
  const next = getNextBusinessOpening(company);
  if (!next) return null;
  return `Our support team will be available again ${next.displayText}.`;
}

async function getSupportAvailability(company) {
  const onlineAgentCount = await countOnlineLiveChatAgents(company);
  const withinHours = isWithinBusinessHours(company);
  const liveSupportEnabled = company.liveChat?.enabled !== false;
  const next = getNextBusinessOpening(company);
  let reason = 'available';
  if (!liveSupportEnabled) reason = 'live_support_disabled';
  else if (!withinHours) reason = 'outside_business_hours';
  else if (onlineAgentCount === 0) reason = 'no_agents_online';

  return {
    isWithinBusinessHours: withinHours,
    liveSupportEnabled,
    availableAgentCount: withinHours ? onlineAgentCount : 0,
    onlineAgentCount,
    queueOpen: liveSupportEnabled && withinHours && onlineAgentCount > 0,
    estimatedWaitMinutes: onlineAgentCount > 0 ? Math.max(1, 8 - onlineAgentCount) : null,
    nextOpening: next,
    timezone: company.settings?.businessHours?.timezone || company.timezone || 'UTC',
    reason,
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
  formatClock,
};
