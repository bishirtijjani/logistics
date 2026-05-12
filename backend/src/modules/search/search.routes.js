const { Router } = require('express');
const searchController = require('./search.controller');
const { authenticate } = require('../../middlewares/auth.middleware');

const router = Router();

// Authenticated to keep abuse heuristics simple in V1. Phase 6 may revisit
// whether browse should be available pre-auth.
router.use(authenticate);

router.get('/search', searchController.search);
router.get('/nearby', searchController.nearby);

module.exports = router;
