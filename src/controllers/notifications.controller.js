const response = require('../utils/apiResponse');
const {
  getNotificationSettings,
  updateNotificationSettings,
} = require('../services/notification-settings.service');

exports.getSettings = async (req, res, next) => {
  try {
    return response.success(res, {
      notifications: getNotificationSettings(req.user),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const notifications = await updateNotificationSettings(req.user, req.body);
    return response.success(res, { notifications }, 'Notification settings saved');
  } catch (err) {
    if (err.statusCode === 400) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};
