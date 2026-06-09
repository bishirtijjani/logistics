/**
 * Rider routes - /rider
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
  reuploadDocumentSchema,
  declineOfferSchema,
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

// Phase 7 - performance metrics + document re-upload + offer decline.
router.get('/performance', authorize('RIDER'), riderController.getPerformance);
router.post(
  '/documents',
  authorize('RIDER'),
  validate(reuploadDocumentSchema),
  riderController.reuploadDocument,
);
router.post(
  '/decline',
  authorize('RIDER'),
  validate(declineOfferSchema),
  riderController.declineOffer,
);

// Admin routes
router.get('/admin/all', authorize('ADMIN'), riderController.getAllRiders);
router.get('/admin/:riderId', authorize('ADMIN'), riderController.getRiderDetails);
router.patch('/admin/:riderId/status', authorize('ADMIN'), riderController.updateRiderStatus);
router.get('/admin/:riderId/earnings', authorize('ADMIN'), riderController.getRiderEarningsAdmin);

module.exports = router;
