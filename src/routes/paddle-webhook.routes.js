const express = require('express');
const { verifyWebhookSignature } = require('../services/paddle.service');
const { handlePaddleWebhookEvent } = require('../services/billing.service');

const router = express.Router();

/**
 * POST /webhooks/paddle
 * Paddle Billing notifications — raw body verified via Paddle-Signature.
 */
router.post('/', async (req, res) => {
  try {
    const signature = req.headers['paddle-signature'];
    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).send('Missing raw body');
    }
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const eventType = req.body?.event_type || req.body?.eventType;
    const data = req.body?.data;
    const result = await handlePaddleWebhookEvent(eventType, data);
    if (!result.handled) {
      console.warn('[paddle webhook]', eventType, result.reason || 'ignored');
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[paddle webhook]', err);
    return res.status(500).send('Webhook handler error');
  }
});

module.exports = router;
