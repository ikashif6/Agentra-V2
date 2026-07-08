/** Default per-event notification rule shape. */
const ruleSchema = {
  sound: { type: String, default: 'classic' },
  browser: { type: Boolean, default: true },
};

/** Known notification event ids and their default rules. */
const DEFAULT_RULES = {
  ticket_assigned: { sound: 'classic', browser: true },
  ticket_mentioned: { sound: 'chime', browser: true },
  snooze_expired: { sound: 'soft', browser: true },
  message_failed: { sound: 'ping', browser: true },
  live_chat_ticket: { sound: 'classic', browser: true },
  channel_email: { sound: 'classic', browser: true },
  channel_chat: { sound: 'chime', browser: true },
  channel_help_center: { sound: 'soft', browser: true },
  channel_whatsapp: { sound: 'ping', browser: false },
  channel_instagram: { sound: 'soft', browser: false },
  channel_facebook: { sound: 'soft', browser: false },
  import_failed: { sound: 'ping', browser: true },
  import_success: { sound: 'chime', browser: false },
};

const VALID_SOUNDS = ['classic', 'chime', 'soft', 'ping', 'none'];

function mergeRules(stored = {}) {
  const merged = {};
  for (const [eventId, defaults] of Object.entries(DEFAULT_RULES)) {
    const saved = stored[eventId] || {};
    merged[eventId] = {
      sound: VALID_SOUNDS.includes(saved.sound) ? saved.sound : defaults.sound,
      browser: typeof saved.browser === 'boolean' ? saved.browser : defaults.browser,
    };
  }
  return merged;
}

function getNotificationSettings(user) {
  const prefs = user.preferences?.notifications || {};
  return {
    volume: typeof prefs.volume === 'number'
      ? Math.min(100, Math.max(0, prefs.volume))
      : 70,
    rules: mergeRules(prefs.rules),
  };
}

function sanitizeUpdate(body = {}) {
  const updates = {};

  if (body.volume !== undefined) {
    const volume = Number(body.volume);
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
      const err = new Error('Volume must be between 0 and 100');
      err.statusCode = 400;
      throw err;
    }
    updates.volume = volume;
  }

  if (body.rules && typeof body.rules === 'object') {
    const rules = {};
    for (const [eventId, rule] of Object.entries(body.rules)) {
      if (!DEFAULT_RULES[eventId] || !rule || typeof rule !== 'object') continue;
      const next = {};
      if (rule.sound !== undefined) {
        if (!VALID_SOUNDS.includes(rule.sound)) continue;
        next.sound = rule.sound;
      }
      if (rule.browser !== undefined) {
        next.browser = Boolean(rule.browser);
      }
      if (Object.keys(next).length > 0) rules[eventId] = next;
    }
    if (Object.keys(rules).length > 0) updates.rules = rules;
  }

  return updates;
}

async function updateNotificationSettings(user, body) {
  const patch = sanitizeUpdate(body);
  if (Object.keys(patch).length === 0) {
    const err = new Error('No valid notification settings to update');
    err.statusCode = 400;
    throw err;
  }

  if (!user.preferences) user.preferences = {};
  if (!user.preferences.notifications) {
    user.preferences.notifications = {
      email: true,
      browser: true,
    };
  }

  if (patch.volume !== undefined) {
    user.preferences.notifications.volume = patch.volume;
  }

  if (patch.rules) {
    const existing = user.preferences.notifications.rules || {};
    const mergedRules = { ...existing };
    for (const [eventId, rule] of Object.entries(patch.rules)) {
      mergedRules[eventId] = {
        ...(mergedRules[eventId] || DEFAULT_RULES[eventId] || {}),
        ...rule,
      };
    }
    user.preferences.notifications.rules = mergedRules;
  }

  user.markModified('preferences');
  await user.save();

  return getNotificationSettings(user);
}

module.exports = {
  DEFAULT_RULES,
  VALID_SOUNDS,
  getNotificationSettings,
  updateNotificationSettings,
};
