const express = require('express');
const facebookController = require('../controllers/facebook.controller');

const router = express.Router();

router.get('/', facebookController.verifyWebhook);
router.post('/', facebookController.handleWebhook);

module.exports = router;
