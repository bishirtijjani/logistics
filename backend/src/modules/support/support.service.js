/**
 * Support service — tickets, disputes, thread messages.
 *
 * Tickets: generic help threads raised by any authenticated user.
 * Disputes: order-specific complaints raised by customers; resolved by admins.
 *   Resolving with FULL_REFUND / PARTIAL_REFUND atomically credits the
 *   customer's wallet via the same `$transaction` pattern used in
 *   request.service.forceCancelRequest.
 *
 * All cross-cutting concerns reuse platform infrastructure:
 *   - prisma           ← config/database
 *   - AppError         ← utils/api-error
 *   - logger           ← utils/logger
 *   - createAuditLog   ← utils/audit
 *   - notifyService    ← services/notify.service (pushAndSocket)
 *   - config           ← config (Cloudinary cloud name for URL validation)
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { createAuditLog } = require('../../utils/audit');
const notifyService = require('../../services/notify.service');
const { config } = require('../../config');

// ============================================================
// Helpers
// ============================================================

const TICKET_THREAD_SELECT = {
  id: true,
  number: true,
  category: true,
  priority: true,
  status: true,
  subject: true,
  description: true,
  attachmentUrls: true,
  resolution: true,
  resolvedAt: true,
  closedAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  assignedToId: true,
  user: {
    select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true },
  },
  assignedTo: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
};

const DISPUTE_THREAD_SELECT = {
  id: true,
  number: true,
  category: true,
  status: true,
  reason: true,
  description: true,
  attachmentUrls: true,
  resolution: true,
  resolutionNotes: true,
  refundAmount: true,
  refundTransactionId: true,
  resolvedAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  requestId: true,
  raisedById: true,
  resolvedById: true,
  raisedBy: {
    select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true },
  },
  resolvedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  request: {
    select: {
      id: true,
      status: true,
      type: true,
      total: true,
      customerPaid: true,
      customerId: true,
      merchantId: true,
      riderId: true,
      deliveredAt: true,
      createdAt: true,
      customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      merchant: { select: { id: true, name: true, phone: true, userId: true } },
      rider: { select: { id: true, userId: true, plateNumber: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
    },
  },
  refundTransaction: {
    select: { id: true, reference: true, amount: true, status: true, createdAt: true },
  },
};

/**
 * Server-side guard: every attachment URL must come from our Cloudinary cloud.
 * Mirrors the prescriptionUrl check in request.service.js.
 */
const validateCloudinaryUrls = (urls = []) => {
  if (!Array.isArray(urls) || urls.length === 0) return;
  const cloudName = (config.CLOUDINARY_CLOUD_NAME || '').trim();
  if (!cloudName) return; // dev mode without Cloudinary — skip
  const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
  for (const url of urls) {
    if (typeof url !== 'string' || !url.startsWith(expectedPrefix)) {
      throw AppError.badRequest('Invalid attachment URL — upload via the in-app flow.', {
        code: 'INVALID_ATTACHMENT_URL',
      });
    }
  }
};

const getAdminUserIds = async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  return admins.map((a) => a.id);
};

const stripInternal = (messages) => messages.filter((m) => !m.isInternal);

// ============================================================
// TICKETS — user-side
// ============================================================

const createTicket = async (userId, data) => {
  validateCloudinaryUrls(data.attachmentUrls);

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      category: data.category,
      priority: data.priority || 'MEDIUM',
      subject: data.subject,
      description: data.description,
      attachmentUrls: data.attachmentUrls || [],
    },
    select: TICKET_THREAD_SELECT,
  });

  // Notify all active admins so someone picks it up.
  const adminIds = await getAdminUserIds();
  await Promise.all(
    adminIds.map((adminId) =>
      notifyService.pushAndSocket(adminId, {
        type: 'SUPPORT',
        title: `New ticket #${ticket.number}`,
        body: `${ticket.subject}`,
        data: { route: `/support/${ticket.id}`, kind: 'ticket', ticketId: ticket.id },
      }),
    ),
  );

  logger.info('support.ticket.created', { ticketId: ticket.id, userId, category: ticket.category });

  return ticket;
};

const listMyTickets = async (userId, { status, category, priority, page = 1, limit = 20 }) => {
  const where = {
    userId,
    ...(status && { status }),
    ...(category && { category }),
    ...(priority && { priority }),
  };

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      select: TICKET_THREAD_SELECT,
      orderBy: { lastActivityAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, total, page, limit };
};

const getTicketById = async (ticketId, viewerId, viewerRole) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      ...TICKET_THREAD_SELECT,
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          fromUser: { select: { id: true, firstName: true, lastName: true, role: true, profilePicture: true } },
        },
      },
    },
  });

  if (!ticket) throw AppError.notFound('Ticket not found');

  const isAdmin = viewerRole === 'ADMIN';
  if (!isAdmin && ticket.userId !== viewerId) {
    throw AppError.forbidden('You do not have access to this ticket');
  }

  if (!isAdmin) {
    ticket.messages = stripInternal(ticket.messages);
  }

  return ticket;
};

const postTicketMessage = async (ticketId, fromUserId, fromUserRole, data) => {
  validateCloudinaryUrls(data.attachmentUrls);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, status: true, assignedToId: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');

  const isAdmin = fromUserRole === 'ADMIN';
  const isOwner = ticket.userId === fromUserId;
  if (!isAdmin && !isOwner) {
    throw AppError.forbidden('You cannot reply to this ticket');
  }
  if (ticket.status === 'CLOSED') {
    throw AppError.badRequest('This ticket is closed');
  }

  const isInternal = isAdmin && data.isInternal === true;

  const nextStatus = (() => {
    if (ticket.status === 'CLOSED') return ticket.status;
    if (isAdmin) {
      // Admin reply moves OPEN → IN_PROGRESS; PENDING_USER stays until user replies.
      if (ticket.status === 'OPEN') return 'IN_PROGRESS';
    } else {
      // User reply moves PENDING_USER → IN_PROGRESS; OPEN stays.
      if (ticket.status === 'PENDING_USER') return 'IN_PROGRESS';
    }
    return ticket.status;
  })();

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId,
        fromUserId,
        body: data.body,
        attachmentUrls: data.attachmentUrls || [],
        isInternal,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true, profilePicture: true } },
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        lastActivityAt: new Date(),
        ...(nextStatus !== ticket.status && { status: nextStatus }),
      },
    }),
  ]);

  // Internal admin notes don't notify the user.
  if (!isInternal) {
    if (isAdmin) {
      await notifyService.pushAndSocket(ticket.userId, {
        type: 'SUPPORT',
        title: 'Support replied',
        body: data.body.length > 80 ? `${data.body.slice(0, 80)}…` : data.body,
        data: { route: `/support/ticket/${ticketId}`, kind: 'ticket', ticketId },
      });
    } else {
      // User replied — notify the assignee (if any) and otherwise all admins.
      const recipients = ticket.assignedToId ? [ticket.assignedToId] : await getAdminUserIds();
      await Promise.all(
        recipients.map((adminId) =>
          notifyService.pushAndSocket(adminId, {
            type: 'SUPPORT',
            title: `User replied on #${ticketId.slice(0, 8)}`,
            body: data.body.length > 80 ? `${data.body.slice(0, 80)}…` : data.body,
            data: { route: `/support/${ticketId}`, kind: 'ticket', ticketId },
          }),
        ),
      );
    }
  }

  return message;
};

const closeTicket = async (ticketId, userId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { userId: true, status: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (ticket.userId !== userId) throw AppError.forbidden('Only the ticket owner can close this ticket');
  if (ticket.status === 'CLOSED') return { id: ticketId, status: 'CLOSED' };

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED', closedAt: new Date(), lastActivityAt: new Date() },
    select: TICKET_THREAD_SELECT,
  });
};

// ============================================================
// TICKETS — admin-side
// ============================================================

const adminListTickets = async ({ status, category, priority, assignedToId, page = 1, limit = 20 }) => {
  const where = {
    ...(status && { status }),
    ...(category && { category }),
    ...(priority && { priority }),
    ...(assignedToId && { assignedToId }),
  };

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      select: TICKET_THREAD_SELECT,
      orderBy: { lastActivityAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, total, page, limit };
};

const adminUpdateTicketStatus = async (ticketId, status, notes, adminUserId, ipAddress, userAgent) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');

  const data = {
    status,
    lastActivityAt: new Date(),
    ...(notes && { resolution: notes }),
    ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
    ...(status === 'CLOSED' && { closedAt: new Date() }),
  };

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data,
    select: TICKET_THREAD_SELECT,
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_TICKET_STATUS',
    'SupportTicket',
    ticketId,
    { previousStatus: ticket.status, newStatus: status, notes },
    ipAddress,
    userAgent,
  );

  // Notify the ticket owner on terminal states.
  if (status === 'RESOLVED' || status === 'CLOSED') {
    await notifyService.pushAndSocket(updated.userId, {
      type: 'SUPPORT',
      title: status === 'RESOLVED' ? 'Ticket resolved' : 'Ticket closed',
      body: notes || `Your ticket has been ${status.toLowerCase()}.`,
      data: { route: `/support/ticket/${ticketId}`, kind: 'ticket', ticketId },
    });
  }

  return updated;
};

const adminAssignTicket = async (ticketId, assignedToId, adminUserId, ipAddress, userAgent) => {
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, role: true },
    });
    if (!assignee || assignee.role !== 'ADMIN') {
      throw AppError.badRequest('Assignee must be an admin');
    }
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assignedToId, lastActivityAt: new Date() },
    select: TICKET_THREAD_SELECT,
  });

  await createAuditLog(
    adminUserId,
    'ASSIGN_TICKET',
    'SupportTicket',
    ticketId,
    { assignedToId },
    ipAddress,
    userAgent,
  );

  return updated;
};

// ============================================================
// DISPUTES — customer-side
// ============================================================

const DISPUTE_WINDOW_DAYS = 7;

const createDispute = async (userId, data, viewerRole = 'CUSTOMER') => {
  validateCloudinaryUrls(data.attachmentUrls);

  const request = await prisma.request.findUnique({
    where: { id: data.requestId },
    select: {
      id: true,
      customerId: true,
      merchantId: true,
      riderId: true,
      status: true,
      deliveredAt: true,
      createdAt: true,
      total: true,
      merchant: { select: { id: true, userId: true, name: true } },
      rider: { select: { id: true, userId: true } },
    },
  });

  if (!request) throw AppError.notFound('Request not found');

  // Authz: customer must own the order; rider must be the assigned rider.
  if (viewerRole === 'CUSTOMER') {
    if (request.customerId !== userId) {
      throw AppError.forbidden('You can only dispute your own orders');
    }
  } else if (viewerRole === 'RIDER') {
    if (!request.rider || request.rider.userId !== userId) {
      throw AppError.forbidden('You can only dispute orders you delivered');
    }
  } else {
    throw AppError.forbidden('Only customers and riders may raise disputes');
  }

  if (!['DELIVERED', 'SETTLED'].includes(request.status)) {
    throw AppError.badRequest('Disputes can only be raised after an order has been delivered.', {
      code: 'DISPUTE_NOT_ELIGIBLE',
    });
  }
  // Window: 7 days from deliveredAt (falls back to createdAt only if missing).
  const anchor = request.deliveredAt || request.createdAt;
  const ageMs = Date.now() - new Date(anchor).getTime();
  if (ageMs > DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    throw AppError.badRequest(`Disputes must be raised within ${DISPUTE_WINDOW_DAYS} days`, {
      code: 'DISPUTE_WINDOW_EXPIRED',
    });
  }

  const existingOpen = await prisma.dispute.findFirst({
    where: {
      requestId: request.id,
      status: { in: ['OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE'] },
    },
    select: { id: true },
  });
  if (existingOpen) {
    throw AppError.conflict('There is already an open dispute on this order', {
      code: 'DISPUTE_ALREADY_OPEN',
    });
  }

  const dispute = await prisma.dispute.create({
    data: {
      requestId: request.id,
      raisedById: userId,
      category: data.category,
      reason: data.reason,
      description: data.description,
      attachmentUrls: data.attachmentUrls || [],
    },
    select: DISPUTE_THREAD_SELECT,
  });

  // Notify all admins, plus the merchant user (if any), plus the OTHER party.
  const adminIds = await getAdminUserIds();
  const recipients = [...adminIds];
  if (request.merchant?.userId) recipients.push(request.merchant.userId);
  // If the customer raised it, also notify the rider (if any). If the rider
  // raised it, notify the customer.
  if (viewerRole === 'CUSTOMER' && request.rider?.userId) {
    recipients.push(request.rider.userId);
  }
  if (viewerRole === 'RIDER' && request.customerId) {
    recipients.push(request.customerId);
  }

  await Promise.all(
    recipients.map((recipientId) =>
      notifyService.pushAndSocket(recipientId, {
        type: 'SUPPORT',
        title: `New dispute #${dispute.number}`,
        body: `${data.category.replace(/_/g, ' ')} — ${data.reason.slice(0, 80)}`,
        data: { route: `/disputes/${dispute.id}`, kind: 'dispute', disputeId: dispute.id },
        requestId: request.id,
      }),
    ),
  );

  logger.info('support.dispute.created', {
    disputeId: dispute.id,
    requestId: request.id,
    customerId: userId,
    category: data.category,
  });

  return dispute;
};

/**
 * List disputes the viewer can see:
 *   - ADMIN: all
 *   - CUSTOMER: disputes they raised
 *   - MERCHANT: disputes on their orders
 */
const listDisputes = async (viewerId, viewerRole, { status, category, page = 1, limit = 20 }) => {
  const where = {
    ...(status && { status }),
    ...(category && { category }),
  };

  if (viewerRole === 'ADMIN') {
    // no scope filter
  } else if (viewerRole === 'CUSTOMER') {
    // Customer sees disputes they raised AND disputes raised against orders
    // they own (e.g. by a rider) so they're never blindsided.
    where.OR = [
      { raisedById: viewerId },
      { request: { customerId: viewerId } },
    ];
  } else if (viewerRole === 'MERCHANT') {
    // Disputes on requests fulfilled by this merchant user.
    const merchant = await prisma.merchant.findFirst({
      where: { userId: viewerId },
      select: { id: true },
    });
    if (!merchant) return { disputes: [], total: 0, page, limit };
    where.request = { merchantId: merchant.id };
  } else if (viewerRole === 'RIDER') {
    // Rider sees disputes they raised AND disputes on requests they delivered.
    const rider = await prisma.rider.findUnique({
      where: { userId: viewerId },
      select: { id: true },
    });
    if (!rider) return { disputes: [], total: 0, page, limit };
    where.OR = [
      { raisedById: viewerId },
      { request: { riderId: rider.id } },
    ];
  } else {
    return { disputes: [], total: 0, page, limit };
  }

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      select: DISPUTE_THREAD_SELECT,
      orderBy: { lastActivityAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  return { disputes, total, page, limit };
};

/**
 * Authz: a viewer may see a dispute if they are:
 *   - ADMIN (any)
 *   - The customer who raised it
 *   - The merchant user that owns the linked merchant
 */
const assertDisputeAccess = async (dispute, viewerId, viewerRole) => {
  if (viewerRole === 'ADMIN') return true;
  if (dispute.raisedById === viewerId) return true;
  if (viewerRole === 'MERCHANT' && dispute.request?.merchant?.userId === viewerId) return true;
  // The customer always sees disputes on their own orders (even those a
  // rider raised against them).
  if (viewerRole === 'CUSTOMER' && dispute.request?.customerId === viewerId) return true;
  // The rider assigned to the request sees disputes on it.
  if (viewerRole === 'RIDER' && dispute.request?.rider?.userId === viewerId) return true;
  throw AppError.forbidden('You do not have access to this dispute');
};

const getDisputeById = async (disputeId, viewerId, viewerRole) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: {
      ...DISPUTE_THREAD_SELECT,
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          fromUser: { select: { id: true, firstName: true, lastName: true, role: true, profilePicture: true } },
        },
      },
    },
  });

  if (!dispute) throw AppError.notFound('Dispute not found');

  await assertDisputeAccess(dispute, viewerId, viewerRole);

  if (viewerRole !== 'ADMIN') {
    dispute.messages = stripInternal(dispute.messages);
  }

  return dispute;
};

const postDisputeMessage = async (disputeId, fromUserId, fromUserRole, data) => {
  validateCloudinaryUrls(data.attachmentUrls);

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      status: true,
      raisedById: true,
      request: {
        select: {
          customerId: true,
          merchant: { select: { userId: true } },
          rider: { select: { userId: true } },
        },
      },
    },
  });
  if (!dispute) throw AppError.notFound('Dispute not found');

  await assertDisputeAccess(dispute, fromUserId, fromUserRole);

  if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
    throw AppError.badRequest('This dispute is closed and cannot accept new messages', {
      code: 'DISPUTE_CLOSED',
    });
  }

  const isAdmin = fromUserRole === 'ADMIN';
  const isInternal = isAdmin && data.isInternal === true;

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        disputeId,
        fromUserId,
        body: data.body,
        attachmentUrls: data.attachmentUrls || [],
        isInternal,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true, profilePicture: true } },
      },
    }),
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        lastActivityAt: new Date(),
        ...(dispute.status === 'OPEN' && { status: 'UNDER_REVIEW' }),
      },
    }),
  ]);

  if (!isInternal) {
    // Notify every party on this dispute except the sender.
    const raisedById = dispute.raisedById;
    const orderCustomerId = dispute.request?.customerId || null;
    const merchantUserId = dispute.request?.merchant?.userId || null;
    const riderUserId = dispute.request?.rider?.userId || null;
    const adminIds = await getAdminUserIds();

    const recipients = new Set();
    if (raisedById && fromUserId !== raisedById) recipients.add(raisedById);
    if (orderCustomerId && fromUserId !== orderCustomerId) recipients.add(orderCustomerId);
    if (merchantUserId && fromUserId !== merchantUserId) recipients.add(merchantUserId);
    if (riderUserId && fromUserId !== riderUserId) recipients.add(riderUserId);
    if (!isAdmin) adminIds.forEach((id) => recipients.add(id));

    await Promise.all(
      [...recipients].map((recipientId) =>
        notifyService.pushAndSocket(recipientId, {
          type: 'SUPPORT',
          title: `New dispute reply`,
          body: data.body.length > 80 ? `${data.body.slice(0, 80)}…` : data.body,
          data: { route: `/disputes/${disputeId}`, kind: 'dispute', disputeId },
        }),
      ),
    );
  }

  return message;
};

// ============================================================
// DISPUTES — admin-side resolution (auto-refund)
// ============================================================

const adminResolveDispute = async (
  disputeId,
  adminUserId,
  { resolution, resolutionNotes, refundAmount },
  ipAddress,
  userAgent,
) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: {
      id: true,
      status: true,
      requestId: true,
      raisedById: true,
      refundTransactionId: true,
      request: {
        select: {
          id: true,
          total: true,
          customerPaid: true,
          customerId: true,
          merchantId: true,
          refundTransactionId: true,
          customer: { select: { id: true, wallet: { select: { id: true, balance: true } } } },
          merchant: { select: { id: true, userId: true, name: true } },
        },
      },
    },
  });

  if (!dispute) throw AppError.notFound('Dispute not found');
  if (['RESOLVED', 'REJECTED'].includes(dispute.status)) {
    throw AppError.badRequest('Dispute is already resolved', { code: 'DISPUTE_ALREADY_RESOLVED' });
  }
  if (!dispute.request) throw AppError.internal('Dispute is missing its linked request');

  const customerPaid = Number(dispute.request.customerPaid);
  const wallet = dispute.request.customer?.wallet;
  if (!wallet && (resolution === 'FULL_REFUND' || resolution === 'PARTIAL_REFUND')) {
    throw AppError.badRequest('Customer wallet not found — cannot refund', {
      code: 'CUSTOMER_WALLET_MISSING',
    });
  }

  let computedRefund = 0;
  if (resolution === 'FULL_REFUND') {
    computedRefund = customerPaid;
  } else if (resolution === 'PARTIAL_REFUND') {
    computedRefund = Number(refundAmount);
    if (!(computedRefund > 0) || computedRefund > customerPaid) {
      throw AppError.badRequest(`Refund must be between 0 and ${customerPaid}`, {
        code: 'INVALID_REFUND_AMOUNT',
      });
    }
  }

  // Defense-in-depth: a request already has a single refundTransactionId slot.
  // Refusing a second refund here prevents a customer who already received one
  // (e.g. via admin force-cancel or merchant withdraw) from getting paid twice.
  if (computedRefund > 0 && dispute.request.refundTransactionId) {
    throw AppError.conflict('This order already has a refund on file. Resolve as REJECTED or RESOLVED_NO_REFUND instead.', {
      code: 'REFUND_ALREADY_ISSUED',
    });
  }

  const nextStatus = resolution === 'REJECTED' ? 'REJECTED' : 'RESOLVED';

  const result = await prisma.$transaction(async (tx) => {
    let refundTransaction = null;

    if (computedRefund > 0) {
      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + computedRefund;

      const reference = `DISPUTE-REFUND-${disputeId}-${Date.now()}`;
      refundTransaction = await tx.transaction.create({
        data: {
          reference,
          type: 'REFUND',
          status: 'COMPLETED',
          amount: computedRefund,
          fee: 0,
          description: `Dispute resolution refund (request ${dispute.requestId})`,
          creditWalletId: wallet.id,
          balanceBefore,
          balanceAfter,
          metadata: { disputeId, requestId: dispute.requestId, adminUserId, resolution },
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: computedRefund } },
      });

      // Link the refund to the request (only if request didn't already track one).
      if (!dispute.request.refundTransactionId) {
        await tx.request.update({
          where: { id: dispute.requestId },
          data: { refundTransactionId: refundTransaction.id },
        });
      }
    }

    const updatedDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: nextStatus,
        resolution,
        resolutionNotes: resolutionNotes || null,
        refundAmount: computedRefund > 0 ? computedRefund : null,
        refundTransactionId: refundTransaction?.id || null,
        resolvedById: adminUserId,
        resolvedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: DISPUTE_THREAD_SELECT,
    });

    return { dispute: updatedDispute, refundTransaction };
  });

  await createAuditLog(
    adminUserId,
    'RESOLVE_DISPUTE',
    'Dispute',
    disputeId,
    { resolution, resolutionNotes, refundAmount: computedRefund },
    ipAddress,
    userAgent,
  );

  // Notify the customer (refund or outcome).
  const customerId = dispute.raisedById;
  if (computedRefund > 0) {
    await notifyService.onWalletEvent(customerId, {
      kind: 'REFUND',
      amount: computedRefund,
      transactionId: result.refundTransaction?.id,
      route: `/disputes/${disputeId}`,
      description: `₦${computedRefund.toLocaleString('en-NG')} refunded for your dispute #${result.dispute.number}.`,
    });
  } else {
    await notifyService.pushAndSocket(customerId, {
      type: 'SUPPORT',
      title: nextStatus === 'REJECTED' ? 'Dispute rejected' : 'Dispute resolved',
      body: resolutionNotes || `Your dispute has been ${nextStatus.toLowerCase()}.`,
      data: { route: `/disputes/${disputeId}`, kind: 'dispute', disputeId },
    });
  }

  // Notify the merchant of the outcome too.
  if (dispute.request.merchant?.userId) {
    await notifyService.pushAndSocket(dispute.request.merchant.userId, {
      type: 'SUPPORT',
      title: 'Dispute closed',
      body: `Dispute #${result.dispute.number} resolved: ${resolution.replace(/_/g, ' ').toLowerCase()}.`,
      data: { route: `/disputes/${disputeId}`, kind: 'dispute', disputeId },
    });
  }
  // Notify the rider involved (if any) — they may have raised the dispute
  // or been the target of one.
  if (result.dispute.request?.rider?.userId &&
      result.dispute.request.rider.userId !== dispute.raisedById) {
    await notifyService.pushAndSocket(result.dispute.request.rider.userId, {
      type: 'SUPPORT',
      title: 'Dispute closed',
      body: `Dispute #${result.dispute.number} resolved: ${resolution.replace(/_/g, ' ').toLowerCase()}.`,
      data: { route: `/disputes/${disputeId}`, kind: 'dispute', disputeId },
    });
  }

  return result.dispute;
};

module.exports = {
  // tickets — user
  createTicket,
  listMyTickets,
  getTicketById,
  postTicketMessage,
  closeTicket,
  // tickets — admin
  adminListTickets,
  adminUpdateTicketStatus,
  adminAssignTicket,
  // disputes — user / merchant
  createDispute,
  listDisputes,
  getDisputeById,
  postDisputeMessage,
  // disputes — admin
  adminResolveDispute,
};
