const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_SCHEDULE = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cloneDefaultSchedule() {
  return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
}

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') {
    throw new Error('Schedule is required');
  }

  for (const day of DAYS) {
    const slot = schedule[day];
    if (!slot) {
      throw new Error(`Missing schedule for ${day}`);
    }
    if (typeof slot.enabled !== 'boolean') {
      throw new Error(`Invalid enabled flag for ${day}`);
    }
    if (!TIME_RE.test(slot.start) || !TIME_RE.test(slot.end)) {
      throw new Error(`Invalid time format for ${day}. Use HH:mm`);
    }
    if (slot.enabled && slot.start >= slot.end) {
      throw new Error(`${day}: start time must be before end time`);
    }
  }

  return schedule;
}

function sanitizeBusinessHoursPayload(body = {}) {
  const { enabled, timezone, schedule } = body;
  const result = {};

  if (enabled !== undefined) result.enabled = Boolean(enabled);
  if (timezone !== undefined) {
    const tz = String(timezone).trim();
    if (!tz) throw new Error('Timezone is required');
    result.timezone = tz;
  }
  if (schedule !== undefined) {
    result.schedule = validateSchedule(schedule);
  }

  return result;
}

function getBusinessHoursResponse(company) {
  const settings = company.settings || {};
  const businessHours = settings.businessHours || {};
  const custom = settings.customBusinessHours || [];

  return {
    default: {
      enabled: Boolean(businessHours.enabled),
      timezone: businessHours.timezone || company.timezone || 'UTC',
      schedule: businessHours.schedule || null,
    },
    custom: custom.map((entry) => ({
      id: entry._id?.toString(),
      name: entry.name,
      targets: entry.targets || [],
      timezone: entry.timezone,
      schedule: entry.schedule,
    })),
  };
}

module.exports = {
  DAYS,
  DEFAULT_SCHEDULE,
  cloneDefaultSchedule,
  validateSchedule,
  sanitizeBusinessHoursPayload,
  getBusinessHoursResponse,
};
