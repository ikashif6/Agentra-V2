const express = require('express');
const tiktokController = require('../controllers/tiktok.controller');

const router = express.Router();

router.get('/oauth/callback', tiktokController.oauthCallback);

module.exports = router;
