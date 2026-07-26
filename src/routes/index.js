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
const facebookChannelRoutes = require('./facebook-channel.routes');
const facebookWebhookRoutes = require('./facebook-webhook.routes');
const instagramChannelRoutes = require('./instagram-channel.routes');
const whatsappChannelRoutes = require('./whatsapp-channel.routes');
const emailChannelRoutes = require('./email-channel.routes');
const tiktokChannelRoutes = require('./tiktok-channel.routes');
const tiktokWebhookRoutes = require('./tiktok-webhook.routes');
const billingRoutes      = require('./billing.routes');
const activityRoutes     = require('./activity.routes');
const notificationsRoutes = require('./notifications.routes');
const workspaceRoutes    = require('./workspace.routes');
const businessHoursRoutes = require('./business-hours.routes');
const storeRoutes        = require('./store.routes');
const storeWebhookRoutes = require('./store-webhook.routes');
const liveChatRoutes     = require('./live-chat.routes');
const widgetRoutes       = require('./widget.routes');
const aiAgentRoutes      = require('./ai-agent.routes');
const helpdeskAiRoutes   = require('./helpdesk-ai.routes');
const chatbotBridgeRoutes = require('./chatbot-bridge.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Agentra API is running',
    build: 'chatbot-bridge-1',
    shopifyConfigured: Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
    chatbotEngineEnabled: ['1', 'true', 'yes'].includes(
      String(process.env.CHATBOT_ENGINE_ENABLED || '').toLowerCase(),
    ) || ['chatbot', 'clean'].includes(
      String(process.env.AI_CONVERSATION_PIPELINE || '').toLowerCase(),
    ),
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
router.use('/channels/facebook', facebookChannelRoutes);
router.use('/channels/instagram', instagramChannelRoutes);
router.use('/channels/whatsapp', whatsappChannelRoutes);
router.use('/channels/email', emailChannelRoutes);
router.use('/channels/tiktok', tiktokChannelRoutes);
router.use('/billing',       billingRoutes);
router.use('/activity-logs', activityRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/workspace',     workspaceRoutes);
router.use('/business-hours', businessHoursRoutes);
router.use('/store',         storeRoutes);
router.use('/live-chat',     liveChatRoutes);
router.use('/ai-agent',      aiAgentRoutes);
router.use('/helpdesk-ai',   helpdeskAiRoutes);
router.use('/chatbot-bridge', chatbotBridgeRoutes);
router.use('/widget',        widgetRoutes);
router.use('/webhooks/facebook', facebookWebhookRoutes);
router.use('/webhooks/tiktok', tiktokWebhookRoutes);
router.use('/webhooks/store', storeWebhookRoutes);

module.exports = router;
