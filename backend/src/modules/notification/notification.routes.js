const { Router } = require('express');
const controller = require('./notification.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

// GET /notifications?page=&limit=&unread=true
router.get('/', controller.listNotifications);

// GET /notifications/unread-count
router.get('/unread-count', controller.getUnreadCount);

// PATCH /notifications/read-all  (must come before /:id/read for correctness)
router.patch('/read-all', controller.markAllRead);

// PATCH /notifications/:id/read
router.patch('/:id/read', controller.markRead);

module.exports = router;
