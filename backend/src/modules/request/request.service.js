/**
 * Request service — unified request lifecycle for all request types
 * 
 * Handles: FOOD, GROCERY, PHARMACY, PACKAGE
 * All follow the same lifecycle with type-specific adaptations
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { config } = require('../../config');
const { getSetting } = require('../../services/settings.service');
const { TRANSITIONS: UNIFIED_TRANSITIONS, canTransition: canTransitionStatus, STATUS } = require('../../utils/status');
const mapsService = require('../../services/maps.service');
const { requestQueue } = require('../../queues');
const { REQUEST_JOBS } = require('../../queues/jobs');
const { getIO } = require('../../sockets');
const { REQUEST, getRequestRoom, getRiderPoolRoom } = require('../../sockets/events');
const {
  emitRequestCreated,
  emitStatusChanged,
  emitMerchantAccepted,
  emitMerchantReady,
  emitRiderAssigned,
  emitCompleted,
  emitCancelled,
} = require('../../sockets/handlers/request.handler');
const notificationService = require('../../services/notification.service');
const { verifyTransactionPin } = require('../auth/auth.service');

// ============================================================
// Status Transition Map (sourced from utils/status — single source of truth)
// ============================================================

const REQUEST_TRANSITIONS = UNIFIED_TRANSITIONS;

// ============================================================
// Calculate Pricing
// ============================================================

const calculatePricing = async (requestData) => {
  const { type, items, package: packageDetails, pickupLat, pickupLng, dropoffLat, dropoffLng } = requestData;

  // Get distance from Google Maps
  const distanceResult = await mapsService.getDistance(
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng
  );

  const distanceKm = distanceResult.distanceKm;
  const estimatedMinutes = Math.ceil(distanceResult.durationSeconds / 60);

  // Fees from platform settings (fall back to config/hardcoded defaults)
  const baseFare = Number(await getSetting('delivery.baseFare', config.DELIVERY_BASE_FARE || 500));
  const perKmRate = Number(await getSetting('delivery.perKmRate', config.DELIVERY_PER_KM_RATE || 100));
  const deliveryFee = Math.ceil((baseFare + distanceKm * perKmRate) / 10) * 10;

  const platformDeliveryFeePercent = Number(await getSetting('delivery.platformFeePercent', config.DELIVERY_PLATFORM_FEE_PERCENT || 30));
  const platformDeliveryFee = Math.ceil((deliveryFee * platformDeliveryFeePercent) / 100);
  
  // Calculate subtotal (for food/grocery/pharmacy)
  let subtotal = 0;
  if (items && items.length > 0) {
    subtotal = items.reduce((sum, item) => {
      const itemTotal = item.unitPrice * item.quantity;
      return sum + itemTotal;
    }, 0);
  }
  
  // Calculate platform fee on subtotal (if applicable)
  const platformItemFeePercent = Number(await getSetting('merchant.platformFeePercent', 15));
  const platformItemFee = subtotal > 0 ? Math.ceil((subtotal * platformItemFeePercent) / 100) : 0;
  
  const platformFee = platformItemFee + platformDeliveryFee;
  const total = subtotal + deliveryFee;
  
  // Calculate splits
  const merchantEarning = subtotal > 0 ? subtotal - platformItemFee : 0;
  const riderEarning = deliveryFee - platformDeliveryFee;
  const platformEarning = platformFee;
  
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    estimatedMinutes,
    subtotal,
    deliveryFee,
    platformFee,
    total,
    merchantEarning,
    riderEarning,
    platformEarning,
  };
};

// ============================================================
// Create Request
// ============================================================

const createRequest = async (customerId, requestData) => {
  const { type: providedType, merchantId, items, package: packageDetails, pin, ...locationData } = requestData;

  // Server infers type from payload shape if not explicitly provided.
  const type = providedType || (merchantId ? 'MERCHANT_ORDER' : 'PACKAGE');

  // Verify transaction PIN (required for wallet deduction)
  if (pin) {
    await verifyTransactionPin(customerId, pin);
  }

  // Check customer has sufficient balance
  const wallet = await prisma.wallet.findUnique({ where: { userId: customerId } });
  if (!wallet) throw AppError.notFound('Wallet not found');
  
  // Calculate pricing
  const pricing = await calculatePricing(requestData);
  
  if (Number(wallet.balance) < pricing.total) {
    throw AppError.insufficientBalance(
      `Insufficient balance. Request costs ₦${pricing.total}. Balance: ₦${wallet.balance}`
    );
  }
  
  // Create request in transaction
  const request = await prisma.$transaction(async (tx) => {
    // Create main request
    const newRequest = await tx.request.create({
      data: {
        type,
        status: 'REQUESTED',
        customerId,
        merchantId: merchantId || null,
        ...locationData,
        ...pricing,
        customerPaid: pricing.total,
      },
    });
    
    // Create items (if applicable)
    if (items && items.length > 0) {
      await tx.requestItem.createMany({
        data: items.map(item => ({
          requestId: newRequest.id,
          productId: item.productId || null,
          name: item.name,
          description: item.description,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          variations: item.variations,
          totalPrice: item.unitPrice * item.quantity,
        })),
      });

      // Decrement stock for products
      for (const item of items) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            const newStock = Math.max(0, product.stock - item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: newStock,
                isAvailable: newStock > 0,
              },
            });
          }
        }
      }
    }
    
    // Create package details (if applicable)
    if (packageDetails) {
      await tx.packageDetail.create({
        data: {
          requestId: newRequest.id,
          ...packageDetails,
        },
      });
    }
    
    // Debit customer wallet into escrow hold
    const reference = `REQ-${newRequest.id}-${uuidv4().slice(0, 8)}`;
    const escrowRef = `${reference}-ESCROW`;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: pricing.total } },
    });

    // Credit escrow system wallet
    await tx.systemWallet.update({
      where: { id: 'PLATFORM_ESCROW' },
      data: { balance: { increment: pricing.total } },
    });

    await tx.transaction.create({
      data: {
        reference: escrowRef,
        type: 'ESCROW_HOLD',
        status: 'COMPLETED',
        amount: pricing.total,
        fee: 0,
        description: `Escrow hold for request ${newRequest.id}`,
        debitWalletId: wallet.id,
        balanceBefore: Number(wallet.balance),
        balanceAfter: Number(wallet.balance) - pricing.total,
        metadata: { requestId: newRequest.id },
      },
    });

    // Update request with escrow transaction ID
    await tx.request.update({
      where: { id: newRequest.id },
      data: { transactionId: escrowRef, escrowTransactionId: escrowRef },
    });
    
    return newRequest;
  });
  
  logger.info('Request created', { requestId: request.id, type, customerId });
  
  // Queue rider matching job (if no merchant, go directly to rider matching)
  // If has merchant, wait for merchant to accept first
  if (!merchantId) {
    await requestQueue.add(REQUEST_JOBS.BROADCAST_TO_RIDERS, {
      requestId: request.id,
      pickupLat: locationData.pickupLat,
      pickupLng: locationData.pickupLng,
      fare: pricing.total,
      distanceKm: pricing.distanceKm,
    }, {
      delay: 1000,
    });
  } else {
    // Notify merchant of new order via socket
    const io = getIO();
    emitRequestCreated(io, request);
  }
  
  // Schedule auto-cancel if no rider accepts within 5 minutes
  await requestQueue.add(REQUEST_JOBS.AUTO_CANCEL_UNMATCHED, {
    requestId: request.id,
  }, {
    delay: 5 * 60 * 1000,
  });
  
  return request;
};

// ============================================================
// Update Request Status
// ============================================================

const updateStatus = async (requestId, newStatus, userId, role, reason) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { id: true, fcmToken: true } },
      merchant: { select: { id: true, userId: true } },
      rider: { select: { id: true, userId: true } },
    },
  });
  
  if (!request) throw AppError.notFound('Request not found');
  
  // Enforce valid transitions
  if (!canTransitionStatus(request.status, newStatus)) {
    throw AppError.badRequest(
      `Invalid status transition: ${request.status} → ${newStatus}`
    );
  }
  
  // Role-based authorization
  if (role === 'CUSTOMER' && newStatus !== 'CANCELLED') {
    throw AppError.forbidden('Customers can only cancel requests');
  }
  if (role === 'MERCHANT' && !['ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'CANCELLED'].includes(newStatus)) {
    throw AppError.forbidden('Merchants can only accept, process, mark ready, or cancel');
  }
  if (role === 'RIDER' && !['RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(newStatus)) {
    throw AppError.forbidden('Riders can only update rider-specific statuses');
  }
  
  const updateData = { status: newStatus };
  
  // Set lifecycle timestamps
  switch (newStatus) {
    case 'ACCEPTED':
      updateData.acceptedAt = new Date();
      break;
    case 'PROCESSING':
      updateData.processingAt = new Date();
      break;
    case 'READY_FOR_PICKUP':
      updateData.readyAt = new Date();
      break;
    case 'RIDER_ASSIGNED':
      updateData.riderAssignedAt = new Date();
      break;
    case 'RIDER_EN_ROUTE':
      updateData.riderEnRouteAt = new Date();
      break;
    case 'PICKED_UP':
      updateData.pickedUpAt = new Date();
      break;
    case 'IN_TRANSIT':
      updateData.inTransitAt = new Date();
      break;
    case 'DELIVERED':
      updateData.deliveredAt = new Date();
      break;
    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = role.toLowerCase();
      updateData.cancellationReason = reason;
      break;
  }
  
  const updated = await prisma.request.update({
    where: { id: requestId },
    data: updateData,
  });
  
  logger.info('Request status updated', { requestId, from: request.status, to: newStatus });

  // Emit socket event for status change
  const io = getIO();
  emitStatusChanged(io, requestId, newStatus);

  // Emit specific events based on status
  if (newStatus === 'RIDER_ASSIGNED' && updated.riderId) {
    emitRiderAssigned(io, requestId, request.customerId, {
      id: updated.riderId,
      name: updated.rider.user.firstName + ' ' + updated.rider.user.lastName,
      phone: updated.rider.user.phone,
      vehicle: updated.rider.vehicleType,
    });
  }

  if (newStatus === 'CANCELLED') {
    emitCancelled(io, requestId, request.customerId, reason || 'Request cancelled');
  }

  // If delivered, trigger settlement
  if (newStatus === 'DELIVERED') {
    await requestQueue.add(REQUEST_JOBS.SETTLE_REQUEST, { requestId }, {
      delay: 5000,
    });
  }
  
  // If cancelled, trigger refund
  if (newStatus === 'CANCELLED') {
    await requestQueue.add(REQUEST_JOBS.REFUND_REQUEST, { requestId }, {
      delay: 1000,
    });
  }

  // If ready for pickup, queue rider matching
  if (newStatus === 'READY_FOR_PICKUP') {
    await requestQueue.add(REQUEST_JOBS.BROADCAST_TO_RIDERS, {
      requestId: request.id,
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
      fare: Number(request.total),
      distanceKm: request.distanceKm,
    }, {
      delay: 1000,
    });
  }

  // Emit socket event for status change
  io.to(getRequestRoom(requestId)).emit(REQUEST.STATUS_CHANGED, {
    requestId,
    status: newStatus,
    timestamp: new Date(),
  });

  // Send push notifications
  if (request.customer?.fcmToken) {
    switch (newStatus) {
      case 'ACCEPTED':
        await notificationService.notifyMerchantAccepted(request.customer.fcmToken, requestId);
        break;
      case 'RIDER_ASSIGNED':
        await notificationService.notifyRiderAssigned(request.customer.fcmToken, requestId);
        break;
      case 'PICKED_UP':
        await notificationService.notifyOrderPickedUp(request.customer.fcmToken, requestId);
        break;
      case 'DELIVERED':
        await notificationService.notifyDeliveryComplete(request.customer.fcmToken, requestId, Number(request.total));
        break;
    }
  }

  return updated;
};

// ============================================================
// Get Requests
// ============================================================

const getRequests = async (userId, role, { page, limit, type, status, categoryId, categorySlug }) => {
  const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const where = {
    ...(role === 'CUSTOMER' ? { customerId: userId } : {}),
    ...(role === 'RIDER' ? { riderId: userId } : {}),
    ...(role === 'MERCHANT' ? { merchantId: userId } : {}),
    ...(type && { type }),
    ...(categoryId && { merchant: { is: { categoryId } } }),
    ...(categorySlug && { merchant: { is: { category: { is: { slug: categorySlug } } } } }),
    ...(statuses && statuses.length > 0 && { status: { in: statuses } }),
  };
  
  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        merchant: { select: { id: true, name: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
        rider: { select: { id: true, vehicleType: true, plateNumber: true, averageRating: true } },
        rating: true,
      },
    }),
    prisma.request.count({ where }),
  ]);
  
  return { requests, total, page, limit };
};

// ============================================================
// Admin Functions
// ============================================================

const getAllRequestsAdmin = async ({ page, limit, type, status, categoryId, categorySlug, startDate, endDate, customerId, merchantId, riderId }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(merchantId && { merchantId }),
    ...(riderId && { riderId }),
    ...(categoryId && { merchant: { is: { categoryId } } }),
    ...(categorySlug && { merchant: { is: { category: { is: { slug: categorySlug } } } } }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        merchant: { select: { id: true, name: true, phone: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
        rider: {
          select: {
            id: true,
            vehicleType: true,
            plateNumber: true,
            averageRating: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        rating: true,
        items: true,
        packageDetails: true,
      },
    }),
    prisma.request.count({ where }),
  ]);

  return { requests, total, page, limit };
};

const reassignRider = async (requestId, newRiderId, adminId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { rider: true },
  });

  if (!request) throw new Error('Request not found');
  if (!['RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP'].includes(request.status)) {
    throw new Error('Cannot reassign rider in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { riderId: newRiderId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fcmToken: true } },
      rider: {
        select: {
          id: true,
          vehicleType: true,
          plateNumber: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  // Emit socket event for rider reassignment
  const io = getIO();
  io.to(getRequestRoom(requestId)).emit(REQUEST.RIDER_ASSIGNED, {
    requestId,
    rider: updated.rider,
  });

  return updated;
};

const forceCancelRequest = async (requestId, reason, adminId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { 
      customer: { include: { wallet: true } },
      items: true,
    },
  });

  if (!request) throw new Error('Request not found');
  if (request.status === 'CANCELLED' || request.status === 'SETTLED') {
    throw new Error('Cannot cancel request in current status');
  }

  const refundAmount = Number(request.customerPaid);

  const updated = await prisma.$transaction(async (tx) => {
    // Update request status
    const updatedRequest = await tx.request.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // Refund customer wallet
    await tx.wallet.update({
      where: { id: request.customer.wallet.id },
      data: { balance: { increment: refundAmount } },
    });

    // Create refund transaction
    const reference = `ADMIN-REFUND-${requestId}-${Date.now()}`;
    await tx.transaction.create({
      data: {
        reference,
        type: 'REFUND',
        status: 'COMPLETED',
        amount: refundAmount,
        fee: 0,
        description: `Admin refund for request ${requestId}: ${reason}`,
        creditWalletId: request.customer.wallet.id,
        balanceBefore: Number(request.customer.wallet.balance),
        balanceAfter: Number(request.customer.wallet.balance) + refundAmount,
        metadata: { requestId, adminId, reason },
      },
    });

    // Restore stock for products
    if (request.items && request.items.length > 0) {
      for (const item of request.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              isAvailable: true,
            },
          });
        }
      }
    }

    return updatedRequest;
  });

  // Emit socket event
  const io = getIO();
  io.to(getRequestRoom(requestId)).emit(REQUEST.CANCELLED, {
    requestId,
    reason,
    cancelledBy: 'ADMIN',
  });

  return updated;
};

const adminUpdateStatus = async (requestId, newStatus, adminId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw new Error('Request not found');

  if (!canTransitionStatus(request.status, newStatus)) {
    throw new Error(`Invalid status transition from ${request.status} to ${newStatus}`);
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: newStatus },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fcmToken: true } },
      merchant: { select: { id: true, name: true } },
      rider: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });

  // Emit socket event
  const io = getIO();
  io.to(getRequestRoom(requestId)).emit(REQUEST.STATUS_CHANGED, {
    requestId,
    status: newStatus,
    timestamp: new Date(),
  });

  return updated;
};

// ============================================================
// Get Request by ID
// ============================================================

const getRequestById = async (requestId, userId, role) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      merchant: { select: { id: true, name: true, phone: true, address: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
      rider: {
        select: {
          id: true,
          vehicleType: true,
          plateNumber: true,
          vehicleColor: true,
          averageRating: true,
          user: { select: { phone: true, firstName: true, lastName: true } },
        },
      },
      items: true,
      packageDetails: true,
      rating: true,
    },
  });
  
  if (!request) throw AppError.notFound('Request not found');
  
  // Authorization
  if (role === 'CUSTOMER' && request.customerId !== userId) {
    throw AppError.forbidden('Not your request');
  }
  if (role === 'RIDER' && request.riderId !== userId) {
    throw AppError.forbidden('Not your assigned request');
  }
  if (role === 'MERCHANT' && request.merchantId !== userId) {
    throw AppError.forbidden('Not your request');
  }
  
  return request;
};

// ============================================================
// Rate Request
// ============================================================

const rateRequest = async (requestId, customerId, ratingData) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== customerId) throw AppError.forbidden('Not your request');
  if (!['DELIVERED', 'SETTLED'].includes(request.status)) {
    throw AppError.badRequest('Can only rate completed requests');
  }
  
  const existing = await prisma.rating.findFirst({
    where: { requestId, customerId },
  });
  if (existing) throw AppError.conflict('Already rated');
  
  const rating = await prisma.rating.create({
    data: {
      requestId,
      riderId: request.riderId,
      customerId,
      ...ratingData,
    },
  });
  
  // Update rider average rating if rider score provided
  if (ratingData.riderScore && request.riderId) {
    const ratings = await prisma.rating.aggregate({
      where: { riderId: request.riderId, riderScore: { not: null } },
      _avg: { riderScore: true },
    });
    
    await prisma.rider.update({
      where: { id: request.riderId },
      data: { averageRating: ratings._avg.riderScore || 0 },
    });
  }
  
  // Update merchant average rating if merchant score provided
  if (ratingData.merchantScore && request.merchantId) {
    const merchantRequests = await prisma.request.findMany({
      where: { merchantId: request.merchantId },
      select: { id: true },
    });
    const requestIds = merchantRequests.map(r => r.id);
    
    const ratings = await prisma.rating.aggregate({
      where: { 
        requestId: { in: requestIds },
        merchantScore: { not: null },
      },
      _avg: { merchantScore: true },
    });
    
    await prisma.merchant.update({
      where: { id: request.merchantId },
      data: { averageRating: ratings._avg.merchantScore || 0 },
    });
  }
  
  return rating;
};

module.exports = {
  calculatePricing,
  createRequest,
  updateStatus,
  getRequests,
  getRequestById,
  rateRequest,
  // Admin functions
  getAllRequestsAdmin,
  reassignRider,
  forceCancelRequest,
  adminUpdateStatus,
};
