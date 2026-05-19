/**
 * Rider controller — HTTP handlers for rider operations.
 */

const riderService = require('./rider.service');
const { ApiResponse } = require('../../utils/api-response');

const register = async (req, res, next) => {
  try {
    const rider = await riderService.registerRider(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Rider registration submitted for approval', rider));
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await riderService.getProfile(req.user.id);
    res.json(ApiResponse.success('Rider profile', profile));
  } catch (error) {
    next(error);
  }
};

const updateAvailability = async (req, res, next) => {
  try {
    const result = await riderService.updateAvailability(req.user.id, req.body.availability);
    res.json(ApiResponse.success('Availability updated', result));
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const result = await riderService.updateLocation(req.user.id, req.body);
    res.json(ApiResponse.success('Location updated', result));
  } catch (error) {
    next(error);
  }
};

const acceptJob = async (req, res, next) => {
  try {
    const order = await riderService.acceptJob(req.user.id, req.body.orderId);
    res.json(ApiResponse.success('Job accepted', order));
  } catch (error) {
    next(error);
  }
};

const getPerformance = async (req, res, next) => {
  try {
    const performance = await riderService.getPerformance(req.user.id);
    res.json(ApiResponse.success('Rider performance', performance));
  } catch (error) {
    next(error);
  }
};

const reuploadDocument = async (req, res, next) => {
  try {
    const result = await riderService.reuploadDocument(req.user.id, req.body);
    res.json(ApiResponse.success('Document re-uploaded', result));
  } catch (error) {
    next(error);
  }
};

const declineOffer = async (req, res, next) => {
  try {
    const { prisma } = require('../../config/database');
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return next({ status: 404, message: 'Rider not found' });
    // Idempotent: if a row exists, flip OFFERED → DECLINED; otherwise create one.
    await prisma.riderOfferLog.upsert({
      where: { riderId_requestId: { riderId: rider.id, requestId: req.body.requestId } },
      create: {
        riderId: rider.id,
        requestId: req.body.requestId,
        outcome: 'DECLINED',
        respondedAt: new Date(),
      },
      update: { outcome: 'DECLINED', respondedAt: new Date() },
    });
    res.json(ApiResponse.success('Offer declined', { requestId: req.body.requestId }));
  } catch (error) {
    next(error);
  }
};

const getEarnings = async (req, res, next) => {
  try {
    // Phase 6 — paginated `recent` rows. `page`/`limit` are optional query
    // params; the dashboard hits with defaults, the breakdown screen passes
    // page=N for infinite scroll.
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 20;
    const earnings = await riderService.getEarnings(req.user.id, { page, limit });
    res.json(ApiResponse.success('Earnings summary', earnings));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Rider Controllers
// ============================================================

const getAllRiders = async (req, res, next) => {
  try {
    const { page, limit, status, availability } = req.query;

    const result = await riderService.getAllRiders({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      availability,
    });

    res.json(
      ApiResponse.success('Riders retrieved', result.riders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const getRiderDetails = async (req, res, next) => {
  try {
    const { riderId } = req.params;

    const rider = await riderService.getRiderDetails(riderId);

    res.json(ApiResponse.success('Rider details', rider));
  } catch (error) {
    next(error);
  }
};

const updateRiderStatus = async (req, res, next) => {
  try {
    const { riderId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const rider = await riderService.updateRiderStatus(riderId, status, adminId);

    res.json(ApiResponse.success('Rider status updated', rider));
  } catch (error) {
    next(error);
  }
};

const getRiderEarningsAdmin = async (req, res, next) => {
  try {
    const { riderId } = req.params;

    const earnings = await riderService.getRiderEarningsAdmin(riderId);

    res.json(ApiResponse.success('Rider earnings', earnings));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  getProfile,
  updateAvailability,
  updateLocation,
  acceptJob,
  getEarnings,
  getPerformance,
  reuploadDocument,
  declineOffer,
  // Admin controllers
  getAllRiders,
  getRiderDetails,
  updateRiderStatus,
  getRiderEarningsAdmin,
};
