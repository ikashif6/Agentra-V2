const express = require('express');
const router = express.Router();
const { bridgeAuthMiddleware } = require('../services/chatbot-bridge/auth');
const ctrl = require('../controllers/chatbot-bridge.controller');

router.use(bridgeAuthMiddleware);

router.get('/workspaces/:workspaceId/config', ctrl.getWorkspaceConfig);
router.get('/workspaces/:workspaceId/knowledge', ctrl.getKnowledge);
router.get('/workspaces/:workspaceId/availability', ctrl.getAvailability);

router.get('/workspaces/:workspaceId/products/search', ctrl.searchProducts);
router.post('/workspaces/:workspaceId/products/search', ctrl.searchProducts);
router.get('/workspaces/:workspaceId/products/:productId', ctrl.getProduct);

router.post('/workspaces/:workspaceId/orders/find', ctrl.findOrder);
router.get('/workspaces/:workspaceId/orders/:orderId', ctrl.getOrder);
router.get('/workspaces/:workspaceId/orders/:orderId/tracking', ctrl.getTracking);
router.post('/workspaces/:workspaceId/orders/:orderId/cancel', ctrl.cancelOrder);
router.post('/workspaces/:workspaceId/orders/:orderId/address', ctrl.changeAddress);
router.post('/workspaces/:workspaceId/orders/:orderId/refund', ctrl.refundOrder);
router.get('/workspaces/:workspaceId/orders/:orderId/refund', ctrl.refundDetails);

module.exports = router;
