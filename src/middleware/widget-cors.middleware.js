const Company = require('../models/Company');
const { isOriginAllowed } = require('../services/live-chat-config.service');

/**
 * Permissive CORS for the public chat widget on merchant storefronts.
 */
async function widgetCors(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-widget-key, x-session-token, Authorization',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  const widgetKey =
    req.query.widgetKey || req.query.key || req.body?.widgetKey || req.headers['x-widget-key'];
  if (widgetKey && origin) {
    try {
      const company = await Company.findOne({ 'liveChat.widgetKey': widgetKey }).lean();
      if (company && !isOriginAllowed(company, origin)) {
        return res.status(403).json({ success: false, message: 'Origin not allowed for this widget' });
      }
    } catch {
      // continue
    }
  }

  next();
}

module.exports = { widgetCors };
