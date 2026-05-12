const { Router } = require('express');
const controller = require('./banner.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticate);

router.get('/', controller.list);

module.exports = router;
