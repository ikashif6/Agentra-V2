const response = require('../utils/apiResponse');
const {
  cloneDefaultSchedule,
  sanitizeBusinessHoursPayload,
  getBusinessHoursResponse,
} = require('../services/business-hours.service');
const { logBusinessHoursUpdated } = require('../services/activity.service');

/**
 * GET /business-hours
 */
exports.getHours = async (req, res, next) => {
  try {
    return response.success(res, {
      businessHours: getBusinessHoursResponse(req.company),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /business-hours/default
 */
exports.updateDefault = async (req, res, next) => {
  try {
    const company = req.company;
    const updates = sanitizeBusinessHoursPayload(req.body);

    if (!company.settings) company.settings = {};
    if (!company.settings.businessHours) {
      company.settings.businessHours = {
        enabled: false,
        timezone: company.timezone || 'UTC',
        schedule: cloneDefaultSchedule(),
      };
    }

    if (updates.enabled !== undefined) {
      company.settings.businessHours.enabled = updates.enabled;
    }
    if (updates.timezone !== undefined) {
      company.settings.businessHours.timezone = updates.timezone;
    }
    if (updates.schedule !== undefined) {
      company.settings.businessHours.schedule = updates.schedule;
    }

    if (company.settings.businessHours.schedule && updates.enabled === undefined) {
      company.settings.businessHours.enabled = true;
    }

    company.markModified('settings');
    await company.save();

    logBusinessHoursUpdated({ company, actor: req.user, req, scope: 'default' });

    return response.success(
      res,
      { businessHours: getBusinessHoursResponse(company) },
      'Default business hours updated',
    );
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /business-hours/custom
 */
exports.createCustom = async (req, res, next) => {
  try {
    const company = req.company;
    const { name, targets, timezone, schedule } = req.body;

    if (!name || !String(name).trim()) {
      return response.badRequest(res, 'Name is required');
    }

    const slotUpdates = sanitizeBusinessHoursPayload({ timezone, schedule });
    if (!slotUpdates.timezone) {
      return response.badRequest(res, 'Timezone is required');
    }
    if (!slotUpdates.schedule) {
      return response.badRequest(res, 'Schedule is required');
    }

    if (!company.settings) company.settings = {};
    if (!Array.isArray(company.settings.customBusinessHours)) {
      company.settings.customBusinessHours = [];
    }

    company.settings.customBusinessHours.push({
      name: String(name).trim(),
      targets: Array.isArray(targets) ? targets.map(String) : [],
      timezone: slotUpdates.timezone,
      schedule: slotUpdates.schedule,
    });

    company.markModified('settings');
    await company.save();

    return response.created(
      res,
      { businessHours: getBusinessHoursResponse(company) },
      'Custom business hours created',
    );
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * PATCH /business-hours/custom/:id
 */
exports.updateCustom = async (req, res, next) => {
  try {
    const company = req.company;
    const { id } = req.params;
    const custom = company.settings?.customBusinessHours;

    if (!Array.isArray(custom)) {
      return response.notFound(res, 'Custom business hours entry not found');
    }

    const entry = custom.id(id);
    if (!entry) {
      return response.notFound(res, 'Custom business hours entry not found');
    }

    const { name, targets, timezone, schedule } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) {
        return response.badRequest(res, 'Name cannot be empty');
      }
      entry.name = String(name).trim();
    }
    if (targets !== undefined) {
      entry.targets = Array.isArray(targets) ? targets.map(String) : [];
    }

    const slotUpdates = sanitizeBusinessHoursPayload({ timezone, schedule });
    if (slotUpdates.timezone !== undefined) entry.timezone = slotUpdates.timezone;
    if (slotUpdates.schedule !== undefined) entry.schedule = slotUpdates.schedule;

    company.markModified('settings');
    await company.save();

    logBusinessHoursUpdated({ company, actor: req.user, req, scope: 'custom' });

    return response.success(
      res,
      { businessHours: getBusinessHoursResponse(company) },
      'Custom business hours updated',
    );
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * DELETE /business-hours/custom/:id
 */
exports.deleteCustom = async (req, res, next) => {
  try {
    const company = req.company;
    const { id } = req.params;
    const custom = company.settings?.customBusinessHours;

    if (!Array.isArray(custom)) {
      return response.notFound(res, 'Custom business hours entry not found');
    }

    const entry = custom.id(id);
    if (!entry) {
      return response.notFound(res, 'Custom business hours entry not found');
    }

    entry.deleteOne();
    company.markModified('settings');
    await company.save();

    return response.success(
      res,
      { businessHours: getBusinessHoursResponse(company) },
      'Custom business hours removed',
    );
  } catch (err) {
    next(err);
  }
};
