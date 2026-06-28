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

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Agentraa API is running',
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

module.exports = router;
