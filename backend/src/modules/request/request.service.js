/**
 * Request service - unified request lifecycle for all request types
 * 
 * Handles: FOOD, GROCERY, PHARMACY, PACKAGE
 * All follow the same lifecycle with type-specific adaptations
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
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
const notifyService = require('../../services/notify.service');
const emailService = require('../../services/email.service');
const { verifyTransactionPin } = require('../auth/auth.service');
const {
  verifyQuoteToken,
  issueCancellationFeeToken,
  verifyCancellationFeeToken,
  CANCEL_FEE_TTL_MS,
} = require('../../utils/quote-token');
const { redis } = require('../../config/redis');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');

// ============================================================
// Status Transition Map (sourced from utils/status - single source of truth)
// ============================================================

const REQUEST_TRANSITIONS = UNIFIED_TRANSITIONS;

// ============================================================
// Resolve & price line items - server-truth, never trusts client.
//
// For each client-supplied item the server:
//   1. Loads the Product (must belong to the merchant if MERCHANT_ORDER)
//   2. Resolves variantId (single-variant products auto-resolve; multi-variant
//      products require an explicit variantId)
//   3. Validates every selected option group exists on the product, the
//      selection respects minSelect/maxSelect, and every required group is satisfied
//   4. Computes unitPrice = variant.price + Σ option priceDeltas
//   5. Snapshots option choices into the shape persisted on RequestItem.selectedOptions
// ============================================================

const resolveLineItems = async (merchantId, rawItems) => {
  if (!rawItems || rawItems.length === 0) return [];

  const productIds = [...new Set(rawItems.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      variants: true,
      optionGroups: { include: { items: true } },
    },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const resolved = [];
  for (const raw of rawItems) {
    const product = productMap.get(raw.productId);
    if (!product) {
      throw AppError.badRequest(`Product ${raw.productId} not found`);
    }
    if (merchantId && product.merchantId !== merchantId) {
      throw AppError.badRequest(`Product ${raw.productId} does not belong to merchant ${merchantId}`);
    }
    if (!product.isAvailable) {
      throw AppError.badRequest(`Product "${product.name}" is unavailable`);
    }

    // Variant resolution
    let variant;
    if (raw.variantId) {
      variant = product.variants.find(v => v.id === raw.variantId);
      if (!variant) throw AppError.badRequest(`Variant ${raw.variantId} not found on product ${product.name}`);
    } else if (product.variants.length === 1) {
      variant = product.variants[0];
    } else if (product.variants.length === 0) {
      throw AppError.badRequest(`Product "${product.name}" has no variants configured`);
    } else {
      throw AppError.badRequest(`Product "${product.name}" has multiple variants - variantId is required`);
    }
    if (!variant.isAvailable) {
      throw AppError.badRequest(`Variant of "${product.name}" is unavailable`);
    }
    if (variant.stock < raw.quantity) {
      throw AppError.badRequest(`Insufficient stock for "${product.name}" (have ${variant.stock}, want ${raw.quantity})`);
    }

    // Option-group validation + price delta accumulation
    const optionsSnapshot = [];
    let optionDelta = 0;
    const providedByGroup = new Map(
      (raw.selectedOptions || []).map(s => [s.groupId, new Set(s.itemIds)])
    );

    for (const group of product.optionGroups) {
      const picked = providedByGroup.get(group.id) || new Set();
      const isRequired = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'REQUIRED_MULTIPLE';

      if (picked.size < group.minSelect) {
        throw AppError.badRequest(`Option group "${group.name}" requires at least ${group.minSelect} selection(s)`);
      }
      if (picked.size > group.maxSelect) {
        throw AppError.badRequest(`Option group "${group.name}" allows at most ${group.maxSelect} selection(s)`);
      }
      if (isRequired && picked.size === 0) {
        throw AppError.badRequest(`Option group "${group.name}" is required`);
      }
      if (group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'OPTIONAL_ONE') {
        if (picked.size > 1) {
          throw AppError.badRequest(`Option group "${group.name}" allows only one selection`);
        }
      }

      const pickedItems = [];
      for (const itemId of picked) {
        const item = group.items.find(i => i.id === itemId);
        if (!item) {
          throw AppError.badRequest(`Option item ${itemId} not found in group "${group.name}"`);
        }
        if (!item.isAvailable) {
          throw AppError.badRequest(`Option "${item.name}" in "${group.name}" is unavailable`);
        }
        optionDelta += Number(item.priceDelta);
        pickedItems.push({ itemId: item.id, itemName: item.name, priceDelta: Number(item.priceDelta) });
      }

      if (pickedItems.length > 0) {
        optionsSnapshot.push({ groupId: group.id, groupName: group.name, items: pickedItems });
      }
    }

    // Reject any extraneous groupIds the client sent that don't exist on the product
    for (const groupId of providedByGroup.keys()) {
      if (!product.optionGroups.find(g => g.id === groupId)) {
        throw AppError.badRequest(`Option group ${groupId} does not exist on this product`);
      }
    }

    const unitPrice = Number(variant.price) + optionDelta;
    const lineTotal = unitPrice * raw.quantity;

    // Phase 8 - normalize substitution preference. Default NONE so the
    // merchant ticket never has to infer intent from null/undefined.
    const substitution = raw.substitution || 'NONE';

    resolved.push({
      productId: product.id,
      product,
      variantId: variant.id,
      variant,
      quantity: raw.quantity,
      unitPrice,
      lineTotal,
      selectedOptions: optionsSnapshot,
      specialInstructions: raw.specialInstructions || null,
      substitution,
      requiresPrescription: Boolean(product.requiresPrescription),
      name: product.name,
      description: product.description || null,
    });
  }

  return resolved;
};

// ============================================================
// Estimate / Calculate Pricing - server-truth pricing.
// Exported so the `/quote` endpoint can return the same numbers
// that createRequest will persist.
// ============================================================

const estimateRequest = async ({
  type,
  merchantId,
  items,
  package: packageDetails,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  resolvedItems, // optional - pass when caller already resolved (avoid double lookup)
  // Phase 4 - when the quote token already locked the distance, reuse it
  // instead of calling Maps again. Google Distance Matrix is non-deterministic
  // for identical coords (traffic/routing variation); a second call within
  // the 5-min TTL would otherwise produce spurious "Quote no longer matches"
  // failures even when the caller did nothing wrong.
  lockedDistanceKm,
  lockedEstimatedMinutes,
  promoCode,
}) => {
  let distanceKm;
  let estimatedMinutes;
  if (typeof lockedDistanceKm === 'number' && typeof lockedEstimatedMinutes === 'number') {
    distanceKm = lockedDistanceKm;
    estimatedMinutes = lockedEstimatedMinutes;
  } else {
    const distanceResult = await mapsService.getDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    distanceKm = distanceResult.distanceKm;
    estimatedMinutes = Math.ceil(distanceResult.durationSeconds / 60);
  }

  // Round distance to 1 dp BEFORE pricing. The quote token only carries the
  // rounded distance, and createRequest re-prices from that locked value - so
  // the fee must derive from the rounded distance in both places. Computing the
  // fee from the raw distance here (while signing the rounded one) made the
  // re-priced fee land on a different ₦10 step for boundary distances, which
  // tripped a spurious QUOTE_MISMATCH on otherwise-valid orders.
  distanceKm = Math.round(distanceKm * 10) / 10;

  // Fees from platform settings (fall back to config defaults)
  const baseFare = Number(await getSetting('delivery.baseFare', config.DELIVERY_BASE_FARE || 500));
  const perKmRate = Number(await getSetting('delivery.perKmRate', config.DELIVERY_PER_KM_RATE || 100));
  const deliveryFee = Math.ceil((baseFare + distanceKm * perKmRate) / 10) * 10;

  const platformDeliveryFeePercent = Number(await getSetting('delivery.platformFeePercent', config.DELIVERY_PLATFORM_FEE_PERCENT || 30));
  const platformDeliveryFee = Math.ceil((deliveryFee * platformDeliveryFeePercent) / 100);

  // Resolve items for subtotal (uses server prices, never client-supplied)
  const resolved = resolvedItems ?? await resolveLineItems(merchantId, items);
  const subtotal = resolved.reduce((sum, it) => sum + it.lineTotal, 0);

  const platformItemFeePercent = Number(await getSetting('merchant.platformFeePercent', 15));
  const platformItemFee = subtotal > 0 ? Math.ceil((subtotal * platformItemFeePercent) / 100) : 0;

  let discountAmount = 0;
  let discountCodeId = null;
  let loadedDiscount = null;

  if (promoCode) {
    const discount = await prisma.discountCode.findUnique({
      where: { code: promoCode.trim().toUpperCase() }
    });

    if (!discount) {
      throw AppError.badRequest(`Promo code "${promoCode}" is invalid.`, { code: 'PROMO_INVALID' });
    }
    if (discount.status !== 'APPROVED') {
      throw AppError.badRequest(`Promo code "${promoCode}" is not active.`, { code: 'PROMO_NOT_ACTIVE' });
    }
    const now = new Date();
    if (discount.startDate && now < new Date(discount.startDate)) {
      throw AppError.badRequest(`Promo code "${promoCode}" has not started yet.`, { code: 'PROMO_NOT_STARTED' });
    }
    if (discount.endDate && now > new Date(discount.endDate)) {
      throw AppError.badRequest(`Promo code "${promoCode}" has expired.`, { code: 'PROMO_EXPIRED' });
    }
    if (discount.used >= discount.usageLimit) {
      throw AppError.badRequest(`Promo code "${promoCode}" has reached its usage limit.`, { code: 'PROMO_LIMIT_REACHED' });
    }
    if (discount.merchantId && discount.merchantId !== merchantId) {
      throw AppError.badRequest(`Promo code "${promoCode}" is not valid for this merchant.`, { code: 'PROMO_MERCHANT_MISMATCH' });
    }
    if (subtotal < Number(discount.minOrder)) {
      throw AppError.badRequest(`Promo code "${promoCode}" requires a minimum spend of ₦${discount.minOrder}.`, { code: 'PROMO_MIN_ORDER' });
    }

    if (discount.type === 'percentage') {
      discountAmount = Math.ceil((subtotal * Number(discount.value)) / 100);
      if (discount.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
      }
    } else {
      discountAmount = Number(discount.value);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    discountCodeId = discount.id;
    loadedDiscount = discount;
  }

  const platformFee = platformItemFee + platformDeliveryFee;
  const total = Math.max(0, subtotal - discountAmount + deliveryFee);

  const merchantEarning = subtotal > 0
    ? Math.max(0, subtotal - platformItemFee - (loadedDiscount && loadedDiscount.merchantId ? discountAmount : 0))
    : 0;
  const riderEarning = deliveryFee - platformDeliveryFee;
  const platformEarning = Math.max(0, platformFee - (loadedDiscount && !loadedDiscount.merchantId ? discountAmount : 0));

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    estimatedMinutes,
    subtotal,
    deliveryFee,
    platformFee,
    tax: 0,
    total,
    merchantEarning,
    riderEarning,
    platformEarning,
    resolvedItems: resolved,
    discountAmount,
    discountCodeId,
  };
};

// Backwards-compat alias for older callers.
const calculatePricing = estimateRequest;

// ============================================================
// Create Request
// ============================================================

const createRequest = async (customerId, requestData) => {
  const {
    type: providedType,
    merchantId,
    items,
    package: packageDetails,
    pin,
    quoteToken,
    prescriptionUrl,
    paymentMethod = 'WALLET',
    promoCode,
    ...locationData
  } = requestData;

  // Server infers type from payload shape if not explicitly provided.
  const type = providedType || (merchantId ? 'MERCHANT_ORDER' : 'PACKAGE');

  // Cash-on-delivery: customer pays the rider directly on delivery, so no
  // wallet debit or escrow hold happens here. The validator already restricts
  // CASH to PACKAGE; re-assert it server-side as a defence-in-depth guard since
  // this branch decides whether money moves at all.
  const isCash = paymentMethod === 'CASH';
  if (isCash && type !== 'PACKAGE') {
    throw AppError.badRequest('Cash payment is only available for package deliveries.', { code: 'CASH_PACKAGE_ONLY' });
  }

  // Verify signed quote token. Spec: stale quotes must be rejected; the
  // fingerprint (type, merchantId, geo) and locked pricing must match the
  // server-recomputed numbers exactly.
  let quotePayload;
  try {
    quotePayload = verifyQuoteToken(quoteToken);
  } catch (err) {
    if (err.code === 'EXPIRED') {
      throw AppError.badRequest('Quote has expired - please request a fresh quote.', { code: 'QUOTE_EXPIRED' });
    }
    throw AppError.badRequest('Invalid quote token.', { code: 'QUOTE_INVALID' });
  }

  // Verify transaction PIN (required for wallet deduction)
  if (pin) {
    await verifyTransactionPin(customerId, pin);
  }

  // Customer wallet - the funding source for WALLET orders. Cash orders never
  // touch it at create time, so a missing/unfunded wallet must not block them.
  const wallet = await prisma.wallet.findUnique({ where: { userId: customerId } });
  if (!wallet && !isCash) throw AppError.notFound('Wallet not found');

  // Resolve + price items server-side (validates variants + option groups).
  const resolvedItems = await resolveLineItems(merchantId, items);

  // Phase 8 - pharmacy gating. If any resolved line points at a product flagged
  // `requiresPrescription`, the request must carry a prescription URL captured
  // via the signed-upload endpoint. Block here rather than at the validator so
  // the rule lives next to the product lookup that determines it (validator
  // doesn't know which products require Rx).
  const rxRequired = resolvedItems.some((it) => it.requiresPrescription);
  if (rxRequired && !prescriptionUrl) {
    throw AppError.badRequest(
      'Prescription required: one or more items need a valid prescription. Upload it at checkout and retry.',
      { code: 'PRESCRIPTION_REQUIRED' },
    );
  }

  // Phase 8 - defensive URL check. The signed-upload endpoint always returns
  // a `res.cloudinary.com/<cloud_name>/...` URL; a customer client supplying
  // anything else (third-party link, internal IP, etc.) would be unsafe to
  // surface to the pharmacist. Skip in dev when Cloudinary is not configured.
  if (prescriptionUrl) {
    const cloudName = (config.CLOUDINARY_CLOUD_NAME || '').trim();
    if (cloudName) {
      const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
      if (!prescriptionUrl.startsWith(expectedPrefix)) {
        throw AppError.badRequest('Invalid prescription URL - upload via the in-app flow.', { code: 'INVALID_PRESCRIPTION_URL' });
      }
    }
  }

  // Compute total pricing using the distance LOCKED in the quote token, so
  // Google Maps non-determinism within the 5-min TTL can't fail an otherwise
  // valid create. The quote signature already binds these numbers - we trust
  // them. (Geo coords + token signature + TTL all verified above.)
  const pricing = await estimateRequest({
    ...requestData,
    type,
    resolvedItems,
    lockedDistanceKm: quotePayload.distanceKm,
    lockedEstimatedMinutes: quotePayload.estimatedMinutes,
    promoCode,
  });
  const { resolvedItems: _omit, discountAmount, discountCodeId, ...persistablePricing } = pricing;

  // Re-validate that the quote payload still matches what we just recomputed.
  // A mismatch means either pricing settings changed mid-quote OR the client
  // tampered with the body - either way we refuse and force a re-quote.
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const round4 = (n) => Math.round(Number(n) * 10000) / 10000;
  const fingerprintMismatch =
    quotePayload.type !== type ||
    (quotePayload.merchantId || null) !== (merchantId || null) ||
    round4(quotePayload.pickupLat) !== round4(locationData.pickupLat) ||
    round4(quotePayload.pickupLng) !== round4(locationData.pickupLng) ||
    round4(quotePayload.dropoffLat) !== round4(locationData.dropoffLat) ||
    round4(quotePayload.dropoffLng) !== round4(locationData.dropoffLng);
  const priceMismatch =
    round2(quotePayload.subtotal) !== round2(pricing.subtotal) ||
    round2(quotePayload.deliveryFee) !== round2(pricing.deliveryFee) ||
    round2(quotePayload.platformFee) !== round2(pricing.platformFee) ||
    round2(quotePayload.total) !== round2(pricing.total) ||
    (quotePayload.promoCode || null) !== (promoCode || null);

  if (fingerprintMismatch || priceMismatch) {
    throw AppError.badRequest(
      'Quote no longer matches the current request - please request a fresh quote.',
      { code: 'QUOTE_MISMATCH' },
    );
  }

  if (!isCash && Number(wallet.balance) < pricing.total) {
    throw AppError.insufficientBalance(
      `Insufficient balance. Request costs ₦${pricing.total}. Balance: ₦${wallet.balance}`
    );
  }

  // Create request in transaction
  const request = await prisma.$transaction(async (tx) => {
    const newRequest = await tx.request.create({
      data: {
        type,
        status: 'REQUESTED',
        customerId,
        merchantId: merchantId || null,
        paymentMethod,
        ...locationData,
        ...persistablePricing,
        discountAmount: discountAmount || 0,
        discountCodeId: discountCodeId || null,
        // Cash never enters the platform ledger at create time, so customerPaid
        // (what the platform received) is 0 - this also makes the cancel/refund
        // path a natural no-op and keeps escrow conservation intact.
        customerPaid: isCash ? 0 : pricing.total,
        // Phase 8 - pharmacy prescription URL. Persisted only when supplied;
        // service already rejected above if Rx was required and missing.
        prescriptionUrl: prescriptionUrl || null,
      },
    });

    if (resolvedItems.length > 0) {
      if (discountCodeId) {
        await tx.discountCode.update({
          where: { id: discountCodeId },
          data: { used: { increment: 1 } },
        });
      }

      await tx.requestItem.createMany({
        data: resolvedItems.map(it => ({
          requestId: newRequest.id,
          productId: it.productId,
          variantId: it.variantId,
          name: it.name,
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          lineTotal: it.lineTotal,
          selectedOptions: it.selectedOptions,
          specialInstructions: it.specialInstructions,
          // Phase 8 - persist grocery substitution preference per line.
          substitution: it.substitution || null,
        })),
      });

      // Decrement stock on the resolved variant (single SKU or many - same path).
      for (const it of resolvedItems) {
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: {
            stock: { decrement: it.quantity },
            // If we just drove stock to zero, flag the SKU unavailable.
            ...((it.variant.stock - it.quantity) <= 0 ? { isAvailable: false } : {}),
          },
        });
      }
    }

    // Create package details (if applicable). Map columns explicitly rather
    // than spreading `packageDetails`: the validator accepts optional keys that
    // have no column (e.g. `fragile`) and omits ones the DB used to require, so
    // a blind spread would throw "Unknown argument" / "Argument is missing" and
    // 500 the whole request. Explicit mapping writes only real columns and lets
    // nullable fields fall back to null.
    if (packageDetails) {
      await tx.packageDetail.create({
        data: {
          requestId: newRequest.id,
          description: packageDetails.description ?? null,
          size: packageDetails.size,
          weight: packageDetails.weight ?? null,
          senderName: packageDetails.senderName,
          senderPhone: packageDetails.senderPhone,
          recipientName: packageDetails.recipientName,
          recipientPhone: packageDetails.recipientPhone,
          instructions: packageDetails.instructions ?? null,
        },
      });
    }
    
    // WALLET only: debit the customer wallet into the platform escrow hold.
    // Cash orders move no money here - the rider collects on delivery and the
    // platform's cut is taken from the rider at settlement instead.
    if (!isCash) {
      const reference = `REQ-${newRequest.id}-${uuidv4().slice(0, 8)}`;
      const escrowRef = `${reference}-ESCROW`;

      // Conditional debit under the row lock so two concurrent wallet-paid orders
      // can't both pass the (pre-transaction) balance read above and overdraw the
      // customer wallet into escrow. The gte check is the authoritative one; the
      // earlier check is only a fast-fail. Mirrors the withdraw/utility guards.
      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, isLocked: false, balance: { gte: pricing.total } },
        data: { balance: { decrement: pricing.total } },
      });
      if (debit.count !== 1) throw AppError.badRequest('Insufficient balance');

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
    }

    return newRequest;
  });
  
  logger.info('Request created', { requestId: request.id, type, customerId });

  // Cash-on-delivery feedback. The customer paid nothing now and owes the rider
  // cash on handover, so confirm the order AND the exact amount due - in-app
  // (push + Notification Center) and as an email receipt. Best-effort: a
  // notification/email failure must not fail the order.
  if (isCash) {
    const amountText = `₦${Number(pricing.total).toLocaleString('en-NG')}`;
    notifyService.pushAndSocket(customerId, {
      type: 'REQUEST_STATUS',
      title: 'Order placed - pay cash on delivery',
      body: `Finding you a rider. Have ${amountText} cash ready to pay on handover. Nothing was charged to your wallet.`,
      data: { route: `/request/${request.id}`, status: 'REQUESTED', kind: 'CASH_ORDER_PLACED' },
      requestId: request.id,
    }).catch((err) => logger.warn('Cash order-placed notification failed', { error: err.message }));

    prisma.user
      .findUnique({ where: { id: customerId }, select: { email: true, firstName: true } })
      .then((u) => {
        if (!u?.email) return null;
        return emailService.sendCashOrderConfirmationEmail(u.email, {
          firstName: u.firstName,
          requestId: request.id,
          amount: pricing.total,
          dropoffAddress: locationData.dropoffAddress,
        });
      })
      .catch((err) => logger.warn('Cash order confirmation email failed', { error: err.message }));
  }

  // Queue rider matching job (if no merchant, go directly to rider matching).
  // The expanding-radius matcher in request.worker enqueues
  // AUTO_CANCEL_UNMATCHED itself once it exhausts all rings - we no longer
  // schedule a duplicate fixed-delay cancel here.
  // For MERCHANT_ORDER, matching is deferred to READY_FOR_PICKUP.
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

    // emitRequestCreated above is a live-only nudge to the merchant room (for
    // the Orders page's sound/toast/refetch) - it has no fallback if the
    // dashboard tab isn't open, and persists nothing. Route the same event
    // through pushAndSocket too so it lands in the merchant's Notification
    // Center and fires a push, same as every other merchant-facing event.
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { userId: true },
    });
    if (merchant?.userId) {
      const amountText = `₦${Number(pricing.total).toLocaleString('en-NG')}`;
      notifyService.pushAndSocket(merchant.userId, {
        type: 'ORDER',
        title: 'New order received',
        body: `New order for ${amountText} - tap to view and accept.`,
        data: { route: '/dashboard/orders' },
        requestId: request.id,
      }).catch((err) => logger.warn('New-order merchant notification failed', { requestId: request.id, error: err.message }));
    }
  }

  return request;
};

// ============================================================
// Update Request Status
// ============================================================

const updateStatus = async (requestId, newStatus, userId, role, payload = {}) => {
  // Backward-compat: older callers passed `reason` as a bare 5th positional
  // string. Normalise so both call shapes work.
  const normalised = typeof payload === 'string'
    ? { reason: payload }
    : (payload || {});
  const reason = normalised.reason;
  // Phase 5 POD payload - only consumed when transitioning to DELIVERED.
  const podPhotoUrl = normalised.podPhotoUrl || null;
  const podSignatureUrl = normalised.podSignatureUrl || null;
  const podDeliveryOtpPlain = normalised.podDeliveryOtp || null;

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
      `Invalid status transition: ${request.status} → ${newStatus}`,
      { code: 'INVALID_TRANSITION' },
    );
  }

  // Role-based authorization
  if (role === 'CUSTOMER' && newStatus !== 'CANCELLED') {
    throw AppError.forbidden('Customers can only cancel requests');
  }
  if (role === 'MERCHANT') {
    if (!['ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'CANCELLED'].includes(newStatus)) {
      throw AppError.forbidden('Merchants can only accept, process, mark ready, or cancel');
    }
    // Per-request ownership check - without it any authenticated merchant
    // could PATCH any other merchant's order through the direct status route.
    if (!request.merchant || request.merchant.userId !== userId) {
      throw AppError.forbidden('Not your order');
    }
  }
  if (role === 'RIDER') {
    if (!['RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(newStatus)) {
      throw AppError.forbidden('Riders can only update rider-specific statuses');
    }
    if (!request.rider || request.rider.userId !== userId) {
      throw AppError.forbidden('Not your assigned order');
    }
  }

  const updateData = { status: newStatus };

  // ── Phase 5: POD validation on DELIVERED ────────────────────────────────
  // Server is authoritative - the client's settings cache may be stale.
  // Admin overrides skip the POD gate: it exists to keep riders honest, and
  // the override path is for orders the rider flow can no longer complete.
  if (newStatus === 'DELIVERED' && role !== 'ADMIN') {
    const [requirePhotoSetting, requireSignatureSetting, otpThresholdSetting] = await Promise.all([
      getSetting('delivery.requirePodPhoto', true),
      getSetting('delivery.requireSignature', false),
      getSetting('delivery.podOtpThresholdNgn', 50000),
    ]);
    // `value` is stored as JSON and could land as a real boolean, the strings
    // "true"/"false", or a 0/1 from a legacy admin import. Treat anything
    // that isn't a clear `true`/"true"/1 as false.
    const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';
    const requirePhoto = truthy(requirePhotoSetting);
    const requireSignature = truthy(requireSignatureSetting);
    const otpThreshold = Number(otpThresholdSetting) || 0;
    const orderTotal = Number(request.total || 0);

    // Validate Cloudinary URL belongs to our cloud - same defense the
    // prescriptionUrl uses on create. Skipped in dev when Cloudinary is unset.
    const cloudName = (config.CLOUDINARY_CLOUD_NAME || '').trim();
    const expectedPrefix = cloudName ? `https://res.cloudinary.com/${cloudName}/` : null;
    const assertCloudinary = (url, code) => {
      if (!cloudName) return;
      if (!url || !url.startsWith(expectedPrefix)) {
        throw AppError.badRequest('Invalid POD URL - upload via the in-app flow.', { code });
      }
    };

    if (requirePhoto) {
      if (!podPhotoUrl) {
        throw AppError.badRequest('A doorstep photo is required to complete delivery.', {
          code: 'POD_PHOTO_REQUIRED',
        });
      }
      assertCloudinary(podPhotoUrl, 'POD_PHOTO_INVALID');
      updateData.podPhotoUrl = podPhotoUrl;
    } else if (podPhotoUrl) {
      // Setting may be off but the client opted to send anyway - accept it.
      assertCloudinary(podPhotoUrl, 'POD_PHOTO_INVALID');
      updateData.podPhotoUrl = podPhotoUrl;
    }

    if (requireSignature) {
      if (!podSignatureUrl) {
        throw AppError.badRequest('A recipient signature is required to complete delivery.', {
          code: 'POD_SIGNATURE_REQUIRED',
        });
      }
      assertCloudinary(podSignatureUrl, 'POD_SIGNATURE_INVALID');
      updateData.podSignatureUrl = podSignatureUrl;
    } else if (podSignatureUrl) {
      assertCloudinary(podSignatureUrl, 'POD_SIGNATURE_INVALID');
      updateData.podSignatureUrl = podSignatureUrl;
    }

    if (otpThreshold > 0 && orderTotal >= otpThreshold) {
      if (!podDeliveryOtpPlain) {
        throw AppError.badRequest(
          'This order needs a customer OTP. Tap "Send code to customer" first.',
          { code: 'POD_OTP_REQUIRED' },
        );
      }
      if (!request.podDeliveryOtp) {
        // Rider attempted OTP without us having generated one - they likely
        // skipped the "Send code" CTA. Surface a specific code so the client
        // re-opens the OTP sheet with the generate button.
        throw AppError.badRequest(
          'No code has been issued for this delivery yet. Tap "Send code to customer".',
          { code: 'POD_OTP_NOT_ISSUED' },
        );
      }
      const matches = await bcrypt.compare(podDeliveryOtpPlain, request.podDeliveryOtp);
      if (!matches) {
        throw AppError.badRequest('That code doesn\'t match. Ask the customer to read it again.', {
          code: 'POD_OTP_MISMATCH',
        });
      }
    }

    updateData.podCapturedAt = new Date();
  }

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
    include: {
      rider: {
        select: {
          id: true,
          vehicleType: true,
          plateNumber: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
      // Phase 8 - merchant category drives push-notification copy
      // ("Pharmacist preparing…", "Picking your groceries").
      // Mirrors the slug visible in the in-app status banner.
      merchant: {
        select: {
          id: true,
          category: { select: { id: true, slug: true } },
        },
      },
    },
  });

  logger.info('Request status updated', { requestId, from: request.status, to: newStatus });

  // Emit socket event for status change. On DELIVERED we also attach the POD
  // URLs so the customer's tracking screen flips to the "Proof of delivery"
  // card in the same tick - without it, the customer would see DELIVERED but
  // no photo until the next manual refetch.
  const io = getIO();
  const statusMeta = newStatus === 'DELIVERED'
    ? {
        podPhotoUrl: updated.podPhotoUrl || null,
        podSignatureUrl: updated.podSignatureUrl || null,
        podCapturedAt: updated.podCapturedAt || null,
      }
    : undefined;
  emitStatusChanged(io, requestId, newStatus, statusMeta, updated.merchantId);

  // Emit specific events based on status. `updated.rider` is null when the
  // request has no rider yet - guard before touching nested user fields.
  if (newStatus === 'RIDER_ASSIGNED' && updated.riderId && updated.rider?.user) {
    const r = updated.rider;
    emitRiderAssigned(io, requestId, request.customerId, {
      id: r.id,
      user: { firstName: r.user.firstName, lastName: r.user.lastName, phone: r.user.phone },
      vehicleType: r.vehicleType,
      plateNumber: r.plateNumber,
    });
  }

  if (newStatus === 'CANCELLED') {
    emitCancelled(io, requestId, request.customerId, reason || 'Request cancelled');
  }

  // If delivered, trigger settlement. Settlement moves money (escrow release,
  // rider/merchant credit, cash commission), so a transient failure must NOT
  // strand the order in DELIVERED forever - retry with backoff. The job is
  // idempotent via the DELIVERED → SETTLED status guard, so retries are safe.
  if (newStatus === 'DELIVERED') {
    await requestQueue.add(REQUEST_JOBS.SETTLE_REQUEST, { requestId }, {
      delay: 5000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s, 40s
    });
  }

  // If cancelled, trigger refund. Also money-movement; guarded by
  // refundTransactionId so retries can't double-credit.
  if (newStatus === 'CANCELLED') {
    await requestQueue.add(REQUEST_JOBS.REFUND_REQUEST, { requestId }, {
      delay: 1000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
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

  // Unified notification pipeline (Notification Center row + socket + push).
  // Per-status copy + deep-link route lives in notifyService.onRequestStatusChanged.
  await notifyService.onRequestStatusChanged(
    { ...updated, customerId: request.customerId },
    request.status,
  );

  return updated;
};

// ============================================================
// Get Requests
// ============================================================

const getRequests = async (userId, role, { page, limit, type, status, categoryId, categorySlug, scope }) => {
  const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : null;
  // Ownership scope. customerId genuinely IS a User.id, so it filters on the
  // JWT id directly. riderId/merchantId are Rider.id/Merchant.id - different
  // UUIDs from the caller's User.id - so those roles MUST filter through the
  // relation on userId, otherwise the list is silently always empty (a rider
  // never sees their deliveries). The merchant ownership + the category
  // filters below both live on the `merchant` relation, so they go in an AND
  // array rather than a single object literal where the later `merchant` key
  // would clobber the ownership filter and leak other merchants' requests.
  //
  // `scope` (customer|rider|merchant) lets one account act under a specific
  // lens regardless of its primary JWT role: the customer app always requests
  // `customer`, so a RIDER/MERCHANT account browsing the customer app sees the
  // orders it BOUGHT, not the jobs it delivered/fulfilled. Defaults to `role`.
  const ownership = (scope ? scope.toUpperCase() : role);
  const where = {
    ...(type && { type }),
    ...(statuses && statuses.length > 0 && { status: { in: statuses } }),
    AND: [
      ...(ownership === 'CUSTOMER' ? [{ customerId: userId }] : []),
      ...(ownership === 'RIDER' ? [{ rider: { is: { userId } } }] : []),
      ...(ownership === 'MERCHANT' ? [{ merchant: { is: { userId } } }] : []),
      ...(categoryId ? [{ merchant: { is: { categoryId } } }] : []),
      ...(categorySlug ? [{ merchant: { is: { category: { is: { slug: categorySlug } } } } }] : []),
    ],
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
        cancelledBy: 'admin',
        cancellationReason: reason,
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

    // Restore stock on the resolved variant for each line item.
    if (request.items && request.items.length > 0) {
      for (const item of request.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
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
      merchant: { select: { id: true, userId: true, name: true, phone: true, address: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
      rider: {
        select: {
          id: true,
          vehicleType: true,
          plateNumber: true,
          vehicleColor: true,
          averageRating: true,
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
      },
      items: true,
      packageDetails: true,
      rating: true,
    },
  });

  if (!request) throw AppError.notFound('Request not found');

  // Authorization by IDENTITY, not scalar role. One account can hold several
  // roles at once (a RIDER account still places customer orders - every
  // authenticated account is a customer), so we must not gate on req.user.role:
  // a RIDER-role customer viewing their own package order would 403 on the RIDER
  // branch ("Not your assigned request"), stranding the tracking screen. The
  // shared isParticipant() helper allows the customer OR the assigned rider OR
  // the merchant owner OR an admin, matching whoever the caller actually is.
  if (!isParticipant(request, userId, role)) {
    throw AppError.forbidden('Not authorized to view this request');
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

// ============================================================
// Customer cancellation - status-gated fee policy
//
// Spec (delivery.cancellationFee from settings):
//   - REQUESTED                                        → free
//   - ACCEPTED | PROCESSING | RIDER_ASSIGNED | RIDER_EN_ROUTE → cancellationFee
//   - PICKED_UP+                                       → 403 (admin only)
// ============================================================

const FREE_CANCEL_STATUSES = new Set(['REQUESTED']);
const FEE_CANCEL_STATUSES = new Set([
  'ACCEPTED',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
]);

const computeCancellationPolicy = async (status) => {
  if (FREE_CANCEL_STATUSES.has(status)) {
    return { allowed: true, fee: 0 };
  }
  if (FEE_CANCEL_STATUSES.has(status)) {
    const feeRaw = await getSetting('delivery.cancellationFee', 0);
    return { allowed: true, fee: Number(feeRaw) || 0 };
  }
  return { allowed: false, fee: 0 };
};

const getCancellationQuote = async (requestId, customerId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, customerId: true, customerPaid: true },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== customerId) throw AppError.forbidden('Not your request');

  const policy = await computeCancellationPolicy(request.status);
  const refund = Math.max(0, Number(request.customerPaid) - policy.fee);

  // Sign the previewed fee for the same 5-min window the customer sees the
  // modal for. The mobile passes this token back on DELETE; we refuse if the
  // current fee differs from the signed one. Closes the
  // settings-mid-cancel race documented in the audit.
  const cancelToken = policy.allowed
    ? issueCancellationFeeToken({
        requestId,
        customerId,
        fee: policy.fee,
        status: request.status,
      })
    : null;

  return {
    status: request.status,
    allowed: policy.allowed,
    fee: policy.fee,
    refundAmount: policy.allowed ? refund : 0,
    cancelToken,
    validForMs: policy.allowed ? CANCEL_FEE_TTL_MS : 0,
  };
};

/**
 * Customer-initiated cancel. Persists Request.cancellationFee so the refund
 * worker can deduct it from the escrow refund and credit it as platform
 * earnings in a single transaction.
 *
 * If the client supplies `cancelToken` from a recent /cancel-quote, we honour
 * the signed fee inside it rather than recomputing - bullet-proofs the flow
 * against admin changing `delivery.cancellationFee` between preview and
 * confirm. Without a token we fall back to the current setting (back-compat
 * + admin cancel paths).
 */
const customerCancelRequest = async (requestId, customerId, reason, cancelToken) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true, customerId: true, status: true, customerPaid: true, escrowTransactionId: true,
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== customerId) throw AppError.forbidden('Not your request');

  const policy = await computeCancellationPolicy(request.status);
  if (!policy.allowed) {
    throw AppError.forbidden('This order can no longer be cancelled - please contact support.');
  }

  // If a signed cancellation-fee token is provided, prefer its locked fee.
  // This is the contract shown to the customer in the modal; honouring it
  // closes the settings-race even across multiple Node processes (the token
  // is signed, not memcached).
  if (cancelToken) {
    let cancelPayload;
    try {
      cancelPayload = verifyCancellationFeeToken(cancelToken);
    } catch (err) {
      if (err.code === 'EXPIRED') {
        throw AppError.badRequest('Cancellation preview expired - please re-open the cancellation prompt.');
      }
      throw AppError.badRequest('Invalid cancellation token.');
    }
    if (cancelPayload.requestId !== requestId || cancelPayload.customerId !== customerId) {
      throw AppError.badRequest('Cancellation token does not match this request.');
    }
    policy.fee = Number(cancelPayload.fee) || 0;
  }

  // Update Request: status + cancellationFee + cancellation metadata.
  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'customer',
      cancellationReason: reason || 'Customer cancelled',
      cancellationFee: policy.fee,
    },
  });

  // Emit cancelled socket event - refund worker fires immediately after.
  // Include the fee so the mobile can render the right cancellation summary
  // without a refetch.
  const io = getIO();
  emitCancelled(io, requestId, customerId, reason || 'Customer cancelled', {
    cancellationFee: policy.fee,
  });

  await requestQueue.add(REQUEST_JOBS.REFUND_REQUEST, { requestId }, { delay: 500 });

  return {
    requestId,
    status: 'CANCELLED',
    cancellationFee: policy.fee,
  };
};

// ============================================================
// Active request - single-query home banner. Backed by the
// (customerId, status) composite index added in Phase 4.
// ============================================================

const ACTIVE_STATUSES_FOR_BANNER = [
  'REQUESTED',
  'ACCEPTED',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
  'PICKED_UP',
  'IN_TRANSIT',
];

const getActiveRequest = async (customerId) => {
  const active = await prisma.request.findFirst({
    where: {
      customerId,
      status: { in: ACTIVE_STATUSES_FOR_BANNER },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      merchant: {
        select: { id: true, name: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } },
      },
      rider: {
        select: { id: true, vehicleType: true, plateNumber: true, averageRating: true },
      },
    },
  });
  return active || null;
};

// ============================================================
// Tracking - live polyline + ETA from rider's last position.
// Cached in Redis for 30s to bound Maps quota during active deliveries.
// ============================================================

const ACTIVE_TRACK_STATUSES = new Set([
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
  'PICKED_UP',
  'IN_TRANSIT',
]);

const isParticipant = (request, userId, role) => {
  if (role === 'ADMIN') return true;
  if (request.customerId === userId) return true;
  if (request.riderId && request.rider?.user?.id === userId) return true;
  if (request.merchantId && request.merchant?.userId === userId) return true;
  // Cheaper alt-path: riderId column = rider.id, but the user comparison
  // catches when callers pass userId not riderId. Both covered above.
  return false;
};

const getActiveRoute = async (requestId, userId, role) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      rider: { select: { id: true, user: { select: { id: true } } } },
      merchant: { select: { id: true, userId: true } },
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (!isParticipant(request, userId, role)) {
    throw AppError.forbidden('Not authorized to view this route');
  }
  if (!ACTIVE_TRACK_STATUSES.has(request.status)) {
    return {
      requestId,
      status: request.status,
      polyline: null,
      etaSeconds: null,
      distanceMeters: null,
      nextCheckpoint: null,
      reason: 'No active rider - route unavailable',
    };
  }

  // Rider position from Redis JSON (set by tracking handler each ping).
  let riderPos = null;
  try {
    const raw = await redis.get(`${REDIS_KEYS.RIDER_LOCATION}${request.rider?.user?.id || request.riderId}`);
    if (raw) riderPos = JSON.parse(raw);
  } catch (_) {}
  if (!riderPos || typeof riderPos.lat !== 'number' || typeof riderPos.lng !== 'number') {
    return {
      requestId,
      status: request.status,
      polyline: null,
      etaSeconds: null,
      distanceMeters: null,
      nextCheckpoint: null,
      reason: 'Rider position not yet available',
    };
  }

  // Pickup or dropoff?
  const preferPickup = !['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'SETTLED'].includes(request.status);
  const destLat = preferPickup ? request.pickupLat : request.dropoffLat;
  const destLng = preferPickup ? request.pickupLng : request.dropoffLng;

  // 30s cache keyed by request + ~10m position bucket. Bucket on position so
  // a moving rider invalidates the cache naturally without us tracking it.
  const bucketLat = Math.round(riderPos.lat * 10000) / 10000;
  const bucketLng = Math.round(riderPos.lng * 10000) / 10000;
  const cacheKey = `${REDIS_KEYS.REQUEST_ROUTE}${requestId}:${preferPickup ? 'P' : 'D'}:${bucketLat}:${bucketLng}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { ...JSON.parse(cached), cached: true };
    }
  } catch (_) {}

  let directions;
  try {
    directions = await mapsService.getDirections(riderPos.lat, riderPos.lng, destLat, destLng);
  } catch (err) {
    logger.warn('Route fetch failed', { requestId, error: err.message });
    return {
      requestId,
      status: request.status,
      polyline: null,
      etaSeconds: null,
      distanceMeters: null,
      nextCheckpoint: preferPickup ? 'PICKUP' : 'DROPOFF',
      reason: 'Unable to compute route at this time',
    };
  }

  const payload = {
    requestId,
    status: request.status,
    polyline: directions.polyline,
    etaSeconds: directions.durationSeconds,
    distanceMeters: directions.distanceMeters,
    nextCheckpoint: preferPickup ? 'PICKUP' : 'DROPOFF',
    riderLat: riderPos.lat,
    riderLng: riderPos.lng,
    destLat,
    destLng,
    computedAt: Date.now(),
  };

  try {
    await redis.set(cacheKey, JSON.stringify(payload), 'EX', REDIS_TTL.REQUEST_ROUTE);
  } catch (_) {}
  return payload;
};

// ============================================================
// In-app messaging
// ============================================================

const assertMessageParticipant = async (requestId, userId, role) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, customerId: true, riderId: true, merchantId: true, rider: { select: { user: { select: { id: true } } } }, merchant: { select: { userId: true } } },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (role === 'ADMIN') return request;
  const allowedUserIds = new Set();
  if (request.customerId) allowedUserIds.add(request.customerId);
  if (request.rider?.user?.id) allowedUserIds.add(request.rider.user.id);
  if (request.merchant?.userId) allowedUserIds.add(request.merchant.userId);
  if (!allowedUserIds.has(userId)) {
    throw AppError.forbidden('Not authorized to message on this request');
  }
  return request;
};

const listMessages = async (requestId, userId, role, { before, limit }) => {
  await assertMessageParticipant(requestId, userId, role);

  const where = { requestId };
  if (before) where.createdAt = { lt: new Date(before) };

  const messages = await prisma.requestMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit || 30, 1), 100),
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
  return messages.reverse(); // chronological ASC for client rendering
};

const postMessage = async (requestId, userId, role, body) => {
  const request = await assertMessageParticipant(requestId, userId, role);

  const message = await prisma.requestMessage.create({
    data: { requestId, fromUserId: userId, body: body.trim() },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  const io = getIO();
  io.to(getRequestRoom(requestId)).emit(REQUEST.MESSAGE_NEW, {
    requestId,
    message,
  });

  // BLK-ChatNotifRouting - push the other parties so a backgrounded app
  // wakes. We route per-recipient role:
  //   - CUSTOMER → /request/:id (customer-app's tracking screen)
  //   - RIDER    → /trip/:id    (rider-app's TripCockpit)
  //   - MERCHANT → /orders/:id  (merchant dashboard's order detail)
  // Recipients with unknown / missing roles still receive the notification
  // (route fallback in each client's notificationRoute lib picks a sensible
  // landing screen from `requestId`), so a stale role lookup never silently
  // drops a message.
  const sender = message.fromUser;
  const senderName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'New message';
  const recipients = [];
  if (request.customerId && request.customerId !== userId) {
    recipients.push({ userId: request.customerId, route: `/request/${requestId}` });
  }
  if (request.rider?.user?.id && request.rider.user.id !== userId) {
    recipients.push({ userId: request.rider.user.id, route: `/trip/${requestId}` });
  }
  if (request.merchant?.userId && request.merchant.userId !== userId) {
    recipients.push({ userId: request.merchant.userId, route: `/orders/${requestId}` });
  }
  const preview = message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body;
  await Promise.all(
    recipients.map(({ userId: rid, route }) =>
      notifyService.pushAndSocket(rid, {
        type: 'REQUEST_MESSAGE',
        title: senderName,
        body: preview,
        data: { route, requestId, kind: 'message' },
        requestId,
      }).catch((err) => logger.warn('postMessage notify failed', { rid, error: err.message })),
    ),
  );

  return message;
};

// ============================================================
// Rider-initiated cancellation - Phase 4.
//
// Only allowed while the rider is actively handling the request
// (RIDER_ASSIGNED, RIDER_EN_ROUTE, PICKED_UP). PIN-protected, fully refunds
// the customer via the REFUND_REQUEST worker. The rider is not charged.
// Emits `request:cancelled` + customer push.
// ============================================================

const RIDER_CANCELLABLE_STATUSES = new Set([
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
  'PICKED_UP',
]);

const riderCancelRequest = async (requestId, userId, { reason, note, pin }) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true, status: true, customerId: true,
      rider: { select: { id: true, userId: true } },
    },
  });
  if (!request) throw AppError.notFound('Request not found');

  if (!request.rider || request.rider.userId !== userId) {
    throw AppError.forbidden('Not your assigned trip');
  }
  if (!RIDER_CANCELLABLE_STATUSES.has(request.status)) {
    throw AppError.badRequest(
      `Cannot cancel a trip in status ${request.status}. Contact support if you need to escalate.`,
      { code: 'RIDER_CANCEL_NOT_ALLOWED' },
    );
  }

  // PIN check - same guard money-moves use, so a stolen phone can't kill
  // an active delivery from the lock-screen quick action.
  await verifyTransactionPin(userId, pin);

  const reasonDescription = note ? `${reason}: ${note}` : reason;

  // Atomic: flip the Request → CANCELLED + reset the rider's server-side
  // availability so the matcher considers them again. If we did these
  // separately and the second update failed, the rider would be stuck at
  // ON_DELIVERY forever despite having no active trip.
  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: 'rider',
        cancellationReason: reasonDescription,
        // No fee - rider cancellations are operational, not punitive.
        cancellationFee: 0,
      },
    });
    // Roll back rider availability from ON_DELIVERY → ONLINE so the dispatcher
    // can offer them work again. The Redis presence key gets refreshed by the
    // next location fix.
    if (request.rider?.id) {
      await tx.rider.update({
        where: { id: request.rider.id },
        data: { availability: 'ONLINE' },
      });
    }
  });

  // Emit socket event so the customer's tracking screen flips immediately.
  const io = getIO();
  emitCancelled(io, requestId, request.customerId, reasonDescription, {
    cancelledBy: 'rider',
    cancellationFee: 0,
  });

  // Refund worker - same path as customer cancel / admin force-cancel.
  await requestQueue.add(REQUEST_JOBS.REFUND_REQUEST, { requestId }, { delay: 500 });

  // Push the customer so they aren't surprised.
  await notifyService.pushAndSocket(request.customerId, {
    type: 'REQUEST_STATUS',
    title: 'Delivery cancelled',
    body: 'Your rider cancelled - your wallet will be refunded shortly.',
    data: { route: `/request/${requestId}`, status: 'CANCELLED' },
    requestId,
  }).catch((err) => logger.warn('riderCancel customer notify failed', { error: err.message }));

  logger.info('rider.cancel', { requestId, riderUserId: userId, reason });

  return { requestId, status: 'CANCELLED', cancelledBy: 'rider', reason };
};

// ============================================================
// Phase 5 - Proof of Delivery OTP generation.
//
// Generates a 6-digit OTP, bcrypts it onto Request.podDeliveryOtp, and
// pushes it to the customer via the unified notification pipeline (push +
// socket + Notification Center). Rate-limited per-request via Redis so the
// rider can't spam the customer with codes. The customer reads the code
// to the rider at the doorstep; the rider enters it on the DeliveryOtpInput
// sheet; the DELIVERED PATCH validates with bcrypt.compare.
// ============================================================

const POD_OTP_GENERATABLE_STATUSES = new Set([
  'PICKED_UP',
  'IN_TRANSIT',
]);
const POD_OTP_REGEN_WINDOW_MS = 10 * 60 * 1000;
const POD_OTP_REGEN_MAX = 3;

const generatePodOtp = async (requestId, riderUserId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true, status: true, total: true, customerId: true,
      rider: { select: { id: true, userId: true } },
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (!request.rider || request.rider.userId !== riderUserId) {
    throw AppError.forbidden('Not your trip');
  }
  if (!POD_OTP_GENERATABLE_STATUSES.has(request.status)) {
    throw AppError.badRequest(
      'OTP can only be issued between pickup and delivery.',
      { code: 'POD_OTP_NOT_YET' },
    );
  }
  // Only worth issuing OTP when the order clears the threshold setting.
  const threshold = Number(await getSetting('delivery.podOtpThresholdNgn', 50000));
  if (threshold > 0 && Number(request.total || 0) < threshold) {
    throw AppError.badRequest(
      'This order does not require an OTP.',
      { code: 'POD_OTP_NOT_REQUIRED' },
    );
  }

  // Rate-limit: max 3 generations per 10-minute window per request. Redis
  // INCR with EX guarantees correct count across processes / pods.
  const rateKey = `pod:otp:rate:${requestId}`;
  try {
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, Math.ceil(POD_OTP_REGEN_WINDOW_MS / 1000));
    }
    if (count > POD_OTP_REGEN_MAX) {
      const ttl = await redis.ttl(rateKey);
      throw AppError.tooManyRequests(
        'Too many OTP requests. Please ask the customer to wait a few minutes.',
        { code: 'POD_OTP_RATE_LIMITED', retryAfterSeconds: ttl > 0 ? ttl : 60 },
      );
    }
  } catch (err) {
    if (err?.code === 'POD_OTP_RATE_LIMITED') throw err;
    logger.warn('pod.otp rate-limit check failed (allowing through)', { error: err.message });
  }

  // 6-digit OTP. Math.random is fine for a short-lived doorstep code, but
  // we use crypto.randomInt for parity with the rest of the codebase that
  // treats codes as security-sensitive.
  const cryptoMod = require('crypto');
  const otp = String(cryptoMod.randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = await bcrypt.hash(otp, 10);

  await prisma.request.update({
    where: { id: requestId },
    data: { podDeliveryOtp: hash },
  });

  // Push to customer - visible in the in-app banner + tray. `data.otp` is
  // included so the customer-app can render the code right in the banner
  // without an extra fetch. SMS is deliberately omitted in v1 (cost) -
  // notifyService handles the push+socket+Notification Center triple.
  await notifyService.pushAndSocket(request.customerId, {
    type: 'POD_OTP_GENERATED',
    title: 'Share this code with your rider',
    body: `Your delivery code is ${otp}. Read it to the rider on arrival.`,
    data: {
      route: `/request/${requestId}`,
      kind: 'pod_otp',
      otp,
    },
    requestId,
  }).catch((err) => logger.warn('pod.otp push failed', { requestId, error: err.message }));

  logger.info('pod.otp.generated', { requestId, riderUserId });

  return { issued: true };
};

// ============================================================
// Address correction - Phase 4 (BLK-AddressCorrection).
//
// Rider supplies a corrected location + note for a wrong pickup/dropoff
// address. We persist an AuditLog row so dispatch can audit and reach out
// to the customer/merchant; we also emit `request:address:correction` and
// push the merchant (when this is a pickup correction) so they can act.
// Does NOT change the request's flow or status - it's an out-of-band signal.
// ============================================================

const ADDRESS_CORRECTION_OPEN_STATUSES = new Set([
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
  'PICKED_UP',
  'IN_TRANSIT',
]);

const recordAddressCorrection = async (
  requestId,
  riderUserId,
  { stage, note, lat, lng, ipAddress, userAgent },
) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true, customerId: true, merchantId: true, status: true,
      pickupAddress: true, dropoffAddress: true,
      pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
      rider: { select: { id: true, userId: true } },
      merchant: { select: { id: true, userId: true } },
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (!request.rider || request.rider.userId !== riderUserId) {
    throw AppError.forbidden('Not your assigned trip');
  }
  if (!ADDRESS_CORRECTION_OPEN_STATUSES.has(request.status)) {
    // Trip already terminal - corrections are operational signals for an
    // in-flight delivery. After settlement/cancellation the right channel
    // is a support ticket, not a correction.
    throw AppError.badRequest(
      'This trip is closed. Open a support ticket instead.',
      { code: 'ADDRESS_CORRECTION_TRIP_CLOSED' },
    );
  }
  // Stage must be relevant to where the rider currently is - accepting a
  // dropoff correction while still RIDER_ASSIGNED/RIDER_EN_ROUTE is fine
  // (rider previewed the dropoff), and a pickup correction post-pickup is
  // historical but still useful for dispatch. We only block obvious nonsense:
  // a pickup correction when the rider is already in transit toward dropoff
  // is too late to act on - they should file a support ticket instead.
  if (stage === 'pickup' && request.status === 'IN_TRANSIT') {
    throw AppError.badRequest(
      'You\'ve already passed pickup. Open a support ticket to escalate.',
      { code: 'ADDRESS_CORRECTION_PICKUP_PASSED' },
    );
  }

  const details = {
    requestId,
    stage,
    note,
    correctedLat: typeof lat === 'number' ? lat : null,
    correctedLng: typeof lng === 'number' ? lng : null,
    originalAddress: stage === 'pickup' ? request.pickupAddress : request.dropoffAddress,
    originalLat: stage === 'pickup' ? request.pickupLat : request.dropoffLat,
    originalLng: stage === 'pickup' ? request.pickupLng : request.dropoffLng,
    raisedAtStatus: request.status,
  };

  await prisma.auditLog.create({
    data: {
      adminUserId: riderUserId,
      action: 'RIDER_ADDRESS_CORRECTION',
      entityType: 'REQUEST',
      entityId: requestId,
      details,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  const io = getIO();
  io.to(getRequestRoom(requestId)).emit(REQUEST.ADDRESS_CORRECTION, {
    requestId,
    stage,
    note,
    lat: details.correctedLat,
    lng: details.correctedLng,
    timestamp: Date.now(),
  });

  // Push merchant (pickup corrections) or customer (dropoff corrections).
  const targetUserId = stage === 'pickup'
    ? (request.merchant?.userId || null)
    : (request.customerId || null);
  if (targetUserId) {
    const title = stage === 'pickup'
      ? 'Rider flagged the pickup address'
      : 'Rider flagged the dropoff address';
    await notifyService.pushAndSocket(targetUserId, {
      type: 'REQUEST_STATUS',
      title,
      body: note.length > 80 ? `${note.slice(0, 80)}…` : note,
      data: {
        route: stage === 'pickup' ? `/merchant/orders/${requestId}` : `/request/${requestId}`,
        kind: 'address-correction',
        stage,
      },
      requestId,
    }).catch((err) => logger.warn('addressCorrection notify failed', { error: err.message }));
  }

  logger.info('rider.address-correction', { requestId, stage, raisedAtStatus: request.status });

  return { requestId, stage, note, lat: details.correctedLat, lng: details.correctedLng };
};

module.exports = {
  calculatePricing,
  estimateRequest,
  resolveLineItems,
  createRequest,
  updateStatus,
  getRequests,
  getRequestById,
  rateRequest,
  computeCancellationPolicy,
  getCancellationQuote,
  customerCancelRequest,
  getActiveRoute,
  getActiveRequest,
  listMessages,
  postMessage,
  // Phase 4 - rider trip cockpit
  riderCancelRequest,
  recordAddressCorrection,
  // Phase 5 - POD
  generatePodOtp,
  // Admin functions
  getAllRequestsAdmin,
  reassignRider,
  forceCancelRequest,
  adminUpdateStatus,
};
