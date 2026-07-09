const express = require('express');
const tiktokController = require('../controllers/tiktok.controller');

const router = express.Router();

router.get('/', tiktokController.handleWebhook);
router.post('/', tiktokController.handleWebhook);

module.exports = router;
