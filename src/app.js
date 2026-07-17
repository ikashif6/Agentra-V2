const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const routes = require('./routes');
const { widgetCors } = require('./middleware/widget-cors.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

// Trust proxy first — required for correct client IPs behind Railway/load balancers.
app.set('trust proxy', 1);

/** Per-user buckets for authenticated traffic; per-IP for everything else. */
function rateLimitKey(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (token.length >= 8) return `auth:${token.slice(-24)}`;
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return `ip:${ipKeyGenerator(forwarded.split(',')[0].trim())}`;
  }
  return `ip:${ipKeyGenerator(req)}`;
}

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'agentraa.com';

// Load verified custom help domains from DB for CORS (cached, refreshed every 5 min)
let customHelpDomains = new Set();
async function refreshCustomHelpDomains() {
  try {
    const HelpCenter = require('./models/HelpCenter');
    const docs = await HelpCenter.find(
      { customDomainVerified: true, customDomain: { $exists: true, $ne: null } },
      { customDomain: 1 }
    ).lean();
    customHelpDomains = new Set(docs.map((d) => d.customDomain));
  } catch {
    // DB might not be ready yet on first boot — ignore
  }
}
// Refresh immediately and then every 5 minutes
refreshCustomHelpDomains();
setInterval(refreshCustomHelpDomains, 5 * 60 * 1000);

function isPublicWidgetPath(reqPath) {
  return (
    reqPath === '/widget.js' ||
    reqPath.startsWith('/widget-loader.js') ||
    reqPath.startsWith('/api/v1/widget')
  );
}

const dashboardCors = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow any *.agentraa.com subdomain and the base app URL
    const allowed = [
      new RegExp(`^https?://([a-z0-9-]+\\.)?${BASE_DOMAIN.replace('.', '\\.')}(:\\d+)?$`),
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/,
      /^http:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/,
    ];

    if (allowed.some((pattern) => pattern.test(origin))) {
      return callback(null, true);
    }

    // Allow verified custom help domains (e.g. https://help.acme.com)
    try {
      const hostname = new URL(origin).hostname;
      if (customHelpDomains.has(hostname)) {
        return callback(null, true);
      }
    } catch {
      // Malformed origin — fall through to deny
    }

    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant', 'x-helpcenter-subdomain'],
});

// Storefront widget assets/API use dedicated CORS (merchant domains), not dashboard CORS.
app.use((req, res, next) => {
  if (isPublicWidgetPath(req.path)) return next();
  return dashboardCors(req, res, next);
});


// ─── Body parsing ─────────────────────────────────────────────────────────────
// Keep the raw body so we can verify Meta webhook signatures (X-Hub-Signature-256).
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl.startsWith('/api/v1/webhooks/')) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Global rate limiter ──────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";

app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    // Authenticated dashboards poll frequently (inbox refresh, etc.), so this
    // abuse-prevention cap must be generous. Login is separately protected by
    // the stricter auth limiter in auth.routes.js.
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || (isProduction ? 2000 : 5000),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    validate: { trustProxy: true },
    message: { success: false, message: 'Too many requests, please slow down.' },
    // Never throttle inbound provider webhooks (Meta can send bursts).
    // Auth routes have their own limiter — don't double-count login attempts here.
    skip: (req) =>
      req.path.startsWith('/api/v1/webhooks/') ||
      req.path.startsWith('/api/v1/widget/') ||
      req.path === '/widget.js' ||
      req.path.startsWith('/widget-loader.js') ||
      req.path.startsWith('/api/v1/auth') ||
      req.path.startsWith('/api/uploads/') ||
      (!isProduction && req.method === 'OPTIONS'),
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/widget', widgetCors);
app.use('/api/v1', routes);

const Company = require('./models/Company');
const storeController = require('./controllers/store.controller');

// Dynamic loader injected into Shopify
app.get('/widget-loader.js', async (req, res, next) => {
  try {
    const widgetKey = String(req.query.key || '');
    if (!widgetKey) {
      res.status(400).type('application/javascript').send('console.error("[Agentra] missing widget key");');
      return;
    }
    const company = await Company.findOne({ 'liveChat.widgetKey': widgetKey });
    if (!company?.liveChat?.enabled) {
      res.type('application/javascript').send('');
      return;
    }
    const apiBase = `${req.protocol}://${req.get('host')}/api/v1/widget`;
    const widgetFile = path.join(__dirname, '../widget/dist/widget.js');
    let bust = String(Date.now());
    try {
      bust = String(fs.statSync(widgetFile).mtimeMs | 0);
    } catch (_) { /* ignore */ }
    const widgetJs = `${req.protocol}://${req.get('host')}/widget.js?v=${bust}`;
    const body = `(function(){window.AgentraConfig={widgetKey:${JSON.stringify(widgetKey)},apiBase:${JSON.stringify(apiBase)}};var s=document.createElement("script");s.src=${JSON.stringify(widgetJs)};s.async=true;document.head.appendChild(s);})();`;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(body);
  } catch (err) {
    next(err);
  }
});

// ─── Embeddable chat widget bundle ───────────────────────────────────────────
app.get('/widget.js', (req, res, next) => {
  const file = path.join(__dirname, '../widget/dist/widget.js');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(file, (err) => {
    if (err) next(err);
  });
});

// ─── Shopify Partner "App URL" entry ──────────────────────────────────────────
// Custom distribution installs land on App URL (often API root) with shop+hmac.
app.get('/', (req, res, next) => {
  if (req.query.shop && req.query.hmac) {
    return storeController.shopifyAppEntry(req, res, next);
  }
  return res.json({
    success: true,
    message: 'Agentra API',
    health: '/api/v1/health',
  });
});

// ─── Static: serve uploaded attachments ──────────────────────────────────────
// Files are stored under /uploads and served at /api/uploads/<filename>
// helmet's crossOriginResourcePolicy is relaxed for this path so browsers can load images
app.use(
  '/api/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '7d',
    index: false,
    dotfiles: 'deny',
  })
);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
