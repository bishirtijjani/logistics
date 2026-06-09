/**
 * Support validator schemas - tickets and disputes.
 *
 * Tickets are generic help threads (any authenticated user).
 * Disputes are formal complaints tied to a specific Request (customer-raised,
 * 3-way thread with merchant + admin).
 */

const { z } = require('zod');

const TICKET_CATEGORIES = [
  'ACCOUNT',
  'PAYMENT',
  'ORDER',
  'DELIVERY',
  'PRODUCT',
  'TECHNICAL',
  'OTHER',
];

const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'PENDING_USER',
  'RESOLVED',
  'CLOSED',
];

const DISPUTE_CATEGORIES = [
  'ITEM_NOT_RECEIVED',
  'ITEM_DAMAGED',
  'WRONG_ITEM',
  'PARTIAL_DELIVERY',
  'RIDER_BEHAVIOR',
  'MERCHANT_BEHAVIOR',
  'PAYMENT_ISSUE',
  'OTHER',
];

const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_RESPONSE',
  'RESOLVED',
  'REJECTED',
];

const DISPUTE_RESOLUTIONS = [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'REJECTED',
  'RESOLVED_NO_REFUND',
];

const attachmentUrlsSchema = z
  .array(z.string().url())
  .max(5, 'Max 5 attachments')
  .optional()
  .default([]);

// ============================================================
// Tickets
// ============================================================

const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES).optional().default('MEDIUM'),
  subject: z.string().trim().min(3, 'Subject is too short').max(200, 'Subject too long'),
  description: z.string().trim().min(10, 'Please describe the issue').max(5000),
  attachmentUrls: attachmentUrlsSchema,
});

const ticketMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required').max(2000),
  attachmentUrls: attachmentUrlsSchema,
  isInternal: z.boolean().optional().default(false),
});

const updateTicketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  notes: z.string().max(2000).optional(),
});

const assignTicketSchema = z.object({
  assignedToId: z.string().uuid().nullable().optional(),
});

const ticketListQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedToId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ============================================================
// Disputes
// ============================================================

const createDisputeSchema = z.object({
  requestId: z.string().uuid(),
  category: z.enum(DISPUTE_CATEGORIES),
  reason: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  attachmentUrls: attachmentUrlsSchema,
});

const disputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  attachmentUrls: attachmentUrlsSchema,
  isInternal: z.boolean().optional().default(false),
});

const resolveDisputeSchema = z
  .object({
    resolution: z.enum(DISPUTE_RESOLUTIONS),
    resolutionNotes: z.string().max(2000).optional(),
    refundAmount: z.coerce.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.resolution === 'PARTIAL_REFUND' && (data.refundAmount === undefined || data.refundAmount <= 0)) {
        return false;
      }
      return true;
    },
    { message: 'refundAmount is required for PARTIAL_REFUND', path: ['refundAmount'] },
  );

const disputeListQuerySchema = z.object({
  status: z.enum(DISPUTE_STATUSES).optional(),
  category: z.enum(DISPUTE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  DISPUTE_CATEGORIES,
  DISPUTE_STATUSES,
  DISPUTE_RESOLUTIONS,
  createTicketSchema,
  ticketMessageSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
  ticketListQuerySchema,
  createDisputeSchema,
  disputeMessageSchema,
  resolveDisputeSchema,
  disputeListQuerySchema,
};
