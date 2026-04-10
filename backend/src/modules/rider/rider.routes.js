/**
 * Rider routes — /api/v1/rider
 */

const { Router } = require('express');
const riderController = require('./rider.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  riderRegistrationSchema,
  updateAvailabilitySchema,
  updateLocationSchema,
  acceptJobSchema,
} = require('./rider.validator');

const router = Router();

router.use(authenticate);

// Registration (any authenticated user can apply to be a rider)
router.post('/register', validate(riderRegistrationSchema), riderController.register);

// Rider-only routes
router.get('/profile', authorize('RIDER'), riderController.getProfile);
router.patch('/availability', authorize('RIDER'), validate(updateAvailabilitySchema), riderController.updateAvailability);
router.post('/location', authorize('RIDER'), validate(updateLocationSchema), riderController.updateLocation);
router.post('/accept', authorize('RIDER'), validate(acceptJobSchema), riderController.acceptJob);
router.get('/earnings', authorize('RIDER'), riderController.getEarnings);

module.exports = router;
