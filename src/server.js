require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5000;

const start = async () => {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('   Add them in Railway → your service → Variables.');
    process.exit(1);
  }

  await connectDB();

  const disableBackgroundJobs = process.env.DISABLE_BACKGROUND_JOBS === 'true';

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Agentra API running on 0.0.0.0:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Base domain : ${process.env.APP_BASE_DOMAIN || 'agentraa.com'}`);
    console.log(`   Health check: http://0.0.0.0:${PORT}/api/v1/health`);
    try {
      const orchPath = require.resolve('./services/live-chat-orchestrator.service');
      const { ORCHESTRATOR_BUILD } = require('./services/live-chat-turn-route.service');
      console.log(`   Live chat orchestrator loaded: ${orchPath}`);
      console.log(`   Live chat workflow version: ${ORCHESTRATOR_BUILD}\n`);
    } catch (e) {
      console.log(`   Live chat orchestrator: failed to resolve (${e.message})\n`);
    }
  });

  const { attachWebSocketServer } = require('./services/live-chat-websocket.service');
  app.locals.liveChatWs = attachWebSocketServer(server);

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };

  // ── Inbound email poller (IMAP mailboxes) ──────────────────────────────────
  const { pollAllMailboxes } = require('./services/email-channel.service');
  const emailPollMs = parseInt(process.env.EMAIL_POLL_INTERVAL_MS, 10) || 60 * 1000;
  let emailPolling = false;
  const runEmailPoll = async () => {
    if (emailPolling) return; // avoid overlapping runs
    emailPolling = true;
    try {
      await pollAllMailboxes();
    } catch (err) {
      console.error('[email poll]', err.message);
    } finally {
      emailPolling = false;
    }
  };
  let emailPollTimer;
  if (disableBackgroundJobs) {
    console.log('   Background jobs: disabled (DISABLE_BACKGROUND_JOBS=true)');
  } else {
    emailPollTimer = setInterval(runEmailPoll, emailPollMs);
    // Kick off shortly after boot (let DB settle).
    setTimeout(runEmailPoll, 10 * 1000);
  }

  // ── Store order sync (fallback for missed webhooks) ────────────────────────
  const Company = require('./models/Company');
  const { syncStoreOrders } = require('./services/store-sync.service');
  const storeSyncMs = parseInt(process.env.STORE_SYNC_INTERVAL_MS, 10) || 15 * 60 * 1000;
  const STORE_SECRET_SELECT =
    '+storeIntegration.shopify.accessToken ' +
    '+storeIntegration.woocommerce.consumerKey ' +
    '+storeIntegration.woocommerce.consumerSecret ' +
    '+storeIntegration.custom.apiKey';
  let storeSyncing = false;
  const runStoreSync = async () => {
    if (storeSyncing) return;
    storeSyncing = true;
    try {
      const companies = await Company.find({ 'storeIntegration.status': 'connected' })
        .select(STORE_SECRET_SELECT);
      for (const company of companies) {
        try {
          await syncStoreOrders(company);
          company.storeIntegration.lastSyncAt = new Date();
          await company.save();
        } catch (err) {
          console.error('[store sync poll]', String(company._id), err.message);
        }
      }
    } catch (err) {
      console.error('[store sync poll]', err.message);
    } finally {
      storeSyncing = false;
    }
  };
  let storeSyncTimer;
  if (!disableBackgroundJobs) {
    storeSyncTimer = setInterval(runStoreSync, storeSyncMs);
    setTimeout(runStoreSync, 30 * 1000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('exit', () => {
    if (emailPollTimer) clearInterval(emailPollTimer);
    if (storeSyncTimer) clearInterval(storeSyncTimer);
  });

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
  });
};

start();
