/**
 * Request controller - handles HTTP requests for unified request operations
 */

const requestService = require('./request.service');
const { ApiResponse } = require('../../utils/api-response');

// ============================================================
// Create Request
// ============================================================

const createRequest = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const requestData = req.body;
    
    const request = await requestService.createRequest(customerId, requestData);
    
    res.status(201).json(
      ApiResponse.success('Request created successfully', request)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Requests (List)
// ============================================================

const getRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { type, status, categoryId, categorySlug, scope, page, limit } = req.query;

    const result = await requestService.getRequests(userId, role, {
      type,
      status,
      categoryId,
      categorySlug,
      scope,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    
    res.json(
      ApiResponse.paginated('Requests retrieved', result.requests, result.page, result.limit, result.total)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Request by ID
// ============================================================

const getRequestById = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    const request = await requestService.getRequestById(requestId, userId, role);
    
    res.json(
      ApiResponse.success('Request retrieved', request)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Request Status
// ============================================================

const updateStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, reason, podPhotoUrl, podSignatureUrl, podDeliveryOtp } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    const request = await requestService.updateStatus(
      requestId,
      status,
      userId,
      role,
      { reason, podPhotoUrl, podSignatureUrl, podDeliveryOtp },
    );

    res.json(
      ApiResponse.success('Request status updated', request)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Cancel Request - customer path. Applies server-driven fee policy.
// ============================================================

const cancelRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason, cancelToken } = req.body;
    const customerId = req.user.id;

    const result = await requestService.customerCancelRequest(requestId, customerId, reason, cancelToken);

    res.json(
      ApiResponse.success(
        result.cancellationFee > 0
          ? `Request cancelled (₦${result.cancellationFee} cancellation fee applied)`
          : 'Request cancelled',
        result,
      ),
    );
  } catch (error) {
    next(error);
  }
};

// Cancellation preview - what would happen if I cancelled right now.
// Customer's tracking screen calls this to show "Cancel with ₦X fee?" copy.
const getCancellationQuote = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const customerId = req.user.id;
    const quote = await requestService.getCancellationQuote(requestId, customerId);
    res.json(ApiResponse.success('Cancellation quote', quote));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Active request - single-shot fetch for the home banner.
// ============================================================

const getActiveRequest = async (req, res, next) => {
  try {
    const active = await requestService.getActiveRequest(req.user.id);
    res.json(ApiResponse.success('Active request', active));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Tracking - route polyline + live ETA
// ============================================================

const getRoute = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const route = await requestService.getActiveRoute(requestId, req.user.id, req.user.role);
    res.json(ApiResponse.success('Route retrieved', route));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Messaging
// ============================================================

const listMessages = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { before, limit } = req.query;
    const messages = await requestService.listMessages(requestId, req.user.id, req.user.role, {
      before,
      limit: limit ? parseInt(limit, 10) : 30,
    });
    res.json(ApiResponse.success('Messages retrieved', messages));
  } catch (error) {
    next(error);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { body } = req.body;
    const message = await requestService.postMessage(requestId, req.user.id, req.user.role, body);
    res.status(201).json(ApiResponse.success('Message posted', message));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Rider-initiated cancellation - Phase 4
// ============================================================

const riderCancelRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason, note, pin } = req.body;
    const userId = req.user.id;

    const result = await requestService.riderCancelRequest(requestId, userId, { reason, note, pin });

    res.json(ApiResponse.success('Trip cancelled', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Phase 5 - Proof of Delivery OTP generation
// ============================================================

const generatePodOtp = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const result = await requestService.generatePodOtp(requestId, userId);
    res.status(201).json(ApiResponse.success('Delivery code sent to customer', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Address correction - Phase 4
// ============================================================

const recordAddressCorrection = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { stage, note, lat, lng } = req.body;
    const userId = req.user.id;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await requestService.recordAddressCorrection(requestId, userId, {
      stage, note, lat, lng, ipAddress, userAgent,
    });

    res.status(201).json(ApiResponse.success('Address correction recorded', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Rate Request
// ============================================================

const rateRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const ratingData = req.body;
    const customerId = req.user.id;
    
    const rating = await requestService.rateRequest(requestId, customerId, ratingData);
    
    res.status(201).json(
      ApiResponse.success('Rating submitted', rating)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Controllers
// ============================================================

const getAllRequestsAdmin = async (req, res, next) => {
  try {
    const { type, status, categoryId, categorySlug, page, limit, startDate, endDate, customerId, merchantId, riderId } = req.query;

    const result = await requestService.getAllRequestsAdmin({
      type,
      status,
      categoryId,
      categorySlug,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
      customerId,
      merchantId,
      riderId,
    });
    
    res.json(
      ApiResponse.success('Requests retrieved', result.requests, {
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

const reassignRider = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { riderId } = req.body;
    const adminId = req.user.id;
    
    const request = await requestService.reassignRider(requestId, riderId, adminId);
    
    res.json(
      ApiResponse.success('Rider reassigned successfully', request)
    );
  } catch (error) {
    next(error);
  }
};

const forceCancelRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    const request = await requestService.forceCancelRequest(requestId, reason, adminId);
    
    res.json(
      ApiResponse.success('Request cancelled by admin', request)
    );
  } catch (error) {
    next(error);
  }
};

const adminUpdateStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    const request = await requestService.adminUpdateStatus(requestId, status, adminId);
    
    res.json(
      ApiResponse.success('Request status updated by admin', request)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Quote (Estimate) - POST with full body shape: same numbers the eventual
// createRequest will persist. Mobile app submits the request payload here,
// shows the breakdown to the user, then submits to POST / with the matching
// shape AND the returned quoteToken. Server re-verifies the token signature
// and TTL before accepting the create.
// ============================================================

const { issueQuoteToken } = require('../../utils/quote-token');

const getQuote = async (req, res, next) => {
  try {
    const pricing = await requestService.estimateRequest(req.body);
    const { resolvedItems, ...quote } = pricing;

    // Server infers the type the same way createRequest does so the token's
    // fingerprint matches the payload that will arrive on POST /.
    const inferredType =
      req.body.type || (req.body.merchantId ? 'MERCHANT_ORDER' : 'PACKAGE');

    const { token, expiresAt } = issueQuoteToken({
      type: inferredType,
      merchantId: req.body.merchantId || null,
      pickupLat: req.body.pickupLat,
      pickupLng: req.body.pickupLng,
      dropoffLat: req.body.dropoffLat,
      dropoffLng: req.body.dropoffLng,
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      platformFee: quote.platformFee,
      tax: quote.tax,
      total: quote.total,
      distanceKm: quote.distanceKm,
      estimatedMinutes: quote.estimatedMinutes,
      promoCode: req.body.promoCode || null,
    });

    res.json(
      ApiResponse.success('Quote calculated', {
        ...quote,
        quoteToken: token,
        validUntil: new Date(expiresAt).toISOString(),
      }),
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getQuote,
  getRequests,
  getRequestById,
  updateStatus,
  cancelRequest,
  getCancellationQuote,
  getRoute,
  getActiveRequest,
  listMessages,
  postMessage,
  rateRequest,
  // Phase 4 - rider trip cockpit
  riderCancelRequest,
  recordAddressCorrection,
  // Phase 5 - POD
  generatePodOtp,
  // Admin controllers
  getAllRequestsAdmin,
  reassignRider,
  forceCancelRequest,
  adminUpdateStatus,
};
