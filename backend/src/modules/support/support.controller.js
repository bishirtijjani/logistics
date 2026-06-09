/**
 * Support controller - HTTP handlers for tickets and disputes.
 *
 * User-side endpoints serve customers, merchants, and (eventually) riders.
 * Admin-side endpoints mirror the existing /admin/disputes and
 * /admin/support/tickets paths but now have a real backing model.
 */

const supportService = require('./support.service');
const { ApiResponse } = require('../../utils/api-response');

// ============================================================
// Tickets - owner
// ============================================================

const createTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.createTicket(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Ticket created', ticket));
  } catch (err) {
    next(err);
  }
};

const listMyTickets = async (req, res, next) => {
  try {
    const { tickets, total, page, limit } = await supportService.listMyTickets(req.user.id, req.query);
    res.json(ApiResponse.paginated('Tickets', tickets, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const ticket = await supportService.getTicketById(req.params.id, req.user.id, req.user.role);
    res.json(ApiResponse.success('Ticket', ticket));
  } catch (err) {
    next(err);
  }
};

const postTicketMessage = async (req, res, next) => {
  try {
    const message = await supportService.postTicketMessage(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body,
    );
    res.status(201).json(ApiResponse.success('Message posted', message));
  } catch (err) {
    next(err);
  }
};

const closeTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.closeTicket(req.params.id, req.user.id);
    res.json(ApiResponse.success('Ticket closed', ticket));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Tickets - admin
// ============================================================

const adminListTickets = async (req, res, next) => {
  try {
    const { tickets, total, page, limit } = await supportService.adminListTickets(req.query);
    res.json(ApiResponse.paginated('Support tickets', tickets, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const adminUpdateTicketStatus = async (req, res, next) => {
  try {
    const ticket = await supportService.adminUpdateTicketStatus(
      req.params.id,
      req.body.status,
      req.body.notes,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Ticket status updated', ticket));
  } catch (err) {
    next(err);
  }
};

const adminAssignTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.adminAssignTicket(
      req.params.id,
      req.body.assignedToId || req.user.id,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Ticket assigned', ticket));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Disputes - user / merchant
// ============================================================

const createDispute = async (req, res, next) => {
  try {
    const dispute = await supportService.createDispute(req.user.id, req.body, req.user.role);
    res.status(201).json(ApiResponse.success('Dispute filed', dispute));
  } catch (err) {
    next(err);
  }
};

const listDisputes = async (req, res, next) => {
  try {
    const { disputes, total, page, limit } = await supportService.listDisputes(
      req.user.id,
      req.user.role,
      req.query,
    );
    res.json(ApiResponse.paginated('Disputes', disputes, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const getDisputeById = async (req, res, next) => {
  try {
    const dispute = await supportService.getDisputeById(req.params.id, req.user.id, req.user.role);
    res.json(ApiResponse.success('Dispute', dispute));
  } catch (err) {
    next(err);
  }
};

const postDisputeMessage = async (req, res, next) => {
  try {
    const message = await supportService.postDisputeMessage(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body,
    );
    res.status(201).json(ApiResponse.success('Message posted', message));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Disputes - admin
// ============================================================

const adminListDisputes = async (req, res, next) => {
  try {
    const { disputes, total, page, limit } = await supportService.listDisputes(
      req.user.id,
      'ADMIN',
      req.query,
    );
    res.json(ApiResponse.paginated('Disputes', disputes, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const adminResolveDispute = async (req, res, next) => {
  try {
    const dispute = await supportService.adminResolveDispute(
      req.params.id,
      req.user.id,
      req.body,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Dispute resolved', dispute));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // tickets - user
  createTicket,
  listMyTickets,
  getTicketById,
  postTicketMessage,
  closeTicket,
  // tickets - admin
  adminListTickets,
  adminUpdateTicketStatus,
  adminAssignTicket,
  // disputes - user / merchant
  createDispute,
  listDisputes,
  getDisputeById,
  postDisputeMessage,
  // disputes - admin
  adminListDisputes,
  adminResolveDispute,
};
