const { Router } = require('express');
const settingsController = require('./settings.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const router = Router();

// Public — used by the mobile app on cold start
router.get('/public', settingsController.getPublicSettings);

// Admin only
router.get('/', authenticate, authorize('ADMIN'), settingsController.getAllSettings);
router.patch('/:key', authenticate, authorize('ADMIN'), settingsController.updateSetting);

module.exports = router;
