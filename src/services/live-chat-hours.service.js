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

async function isTeamAvailableNow(company) {
  const settings = company.settings?.businessHours;
  if (!settings?.enabled || !settings.schedule) {
    return false;
  }
  const tz = settings.timezone || company.timezone || 'UTC';
  const now = new Date();
  const { dayKey, time } = getZonedParts(now, tz);
  const slot = settings.schedule[dayKey];
  if (!slot?.enabled) return false;
  return time >= slot.start && time < slot.end;
}

module.exports = {
  isTeamAvailableNow,
};
