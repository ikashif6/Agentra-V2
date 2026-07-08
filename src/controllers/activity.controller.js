const response = require('../utils/apiResponse');
const { listActivityLogs } = require('../services/activity.service');

/**
 * GET /activity-logs
 * Owner / Admin — paginated workspace activity with filters.
 */
exports.list = async (req, res, next) => {
  try {
    const { actorId, event, from, to, page, limit } = req.query;
    const result = await listActivityLogs(req.company._id, {
      actorId,
      event,
      from,
      to,
      page,
      limit,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};
