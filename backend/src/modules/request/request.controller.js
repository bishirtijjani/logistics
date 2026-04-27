/**
 * Request controller — handles HTTP requests for unified request operations
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
    const { type, status, page, limit } = req.query;
    
    const result = await requestService.getRequests(userId, role, {
      type,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    
    res.json(
      ApiResponse.success('Requests retrieved', result.data, {
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
    const { status, reason } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    const request = await requestService.updateStatus(
      requestId,
      status,
      userId,
      role,
      reason
    );
    
    res.json(
      ApiResponse.success('Request status updated', request)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Cancel Request
// ============================================================

const cancelRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const role = req.user.role;
    
    const request = await requestService.updateStatus(
      requestId,
      'CANCELLED',
      userId,
      role,
      reason
    );
    
    res.json(
      ApiResponse.success('Request cancelled', request)
    );
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
    const { type, status, page, limit, startDate, endDate, customerId, providerId, riderId } = req.query;
    
    const result = await requestService.getAllRequestsAdmin({
      type,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
      customerId,
      providerId,
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

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  updateStatus,
  cancelRequest,
  rateRequest,
  // Admin controllers
  getAllRequestsAdmin,
  reassignRider,
  forceCancelRequest,
  adminUpdateStatus,
};
