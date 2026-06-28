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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Agentraa API running on 0.0.0.0:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Base domain : ${process.env.APP_BASE_DOMAIN || 'agentraa.com'}`);
    console.log(`   Health check: http://0.0.0.0:${PORT}/api/v1/health\n`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
  });
};

start();
