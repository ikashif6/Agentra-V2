const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

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

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Allow any *.agentraa.com subdomain and the base app URL
      const allowed = [
        new RegExp(`^https?://([a-z0-9-]+\\.)?${BASE_DOMAIN.replace('.', '\\.')}(:\\d+)?$`),
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
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
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please slow down.' },
  })
);

// ─── Trust proxy (needed for correct IP behind load balancers) ────────────────
app.set('trust proxy', 1);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

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
