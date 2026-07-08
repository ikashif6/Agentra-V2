const express = require('express');
const router = express.Router();

const authRoutes         = require('./auth.routes');
const ticketRoutes       = require('./ticket.routes');
const uploadRoutes       = require('./upload.routes');
const onboardingRoutes   = require('./onboarding.routes');
const departmentRoutes   = require('./department.routes');
const teamRoutes         = require('./team.routes');
const usersRoutes        = require('./users.routes');
const helpCenterRoutes   = require('./helpcenter.routes');
const storeRoutes        = require('./store.routes');
const businessHoursRoutes = require('./business-hours.routes');
const billingRoutes       = require('./billing.routes');
const activityRoutes      = require('./activity.routes');
const notificationsRoutes = require('./notifications.routes');
const workspaceRoutes     = require('./workspace.routes');
const facebookChannelRoutes = require('./facebook-channel.routes');
const facebookWebhookRoutes = require('./facebook-webhook.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Agentra API is running',
    build: 'fb-connect-2',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

router.use('/auth',        authRoutes);
router.use('/onboarding',  onboardingRoutes);
router.use('/tickets',     ticketRoutes);
router.use('/uploads',     uploadRoutes);
router.use('/departments', departmentRoutes);
router.use('/teams',       teamRoutes);
router.use('/users',       usersRoutes);
router.use('/helpcenter',  helpCenterRoutes);
router.use('/store',       storeRoutes);
router.use('/business-hours', businessHoursRoutes);
router.use('/billing',       billingRoutes);
router.use('/activity-logs', activityRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/workspace', workspaceRoutes);
router.use('/channels/facebook', facebookChannelRoutes);
router.use('/webhooks/facebook', facebookWebhookRoutes);

module.exports = router;
