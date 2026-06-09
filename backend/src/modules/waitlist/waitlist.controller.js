/**
 * Waitlist HTTP controllers.
 *
 * Public:
 *   POST   /waitlist            - anyone (honeypot-protected)
 *
 * Admin:
 *   GET    /admin/waitlist           - list entries
 *   GET    /admin/waitlist/summary   - counts by role/platform
 *   DELETE /admin/waitlist/:id       - remove an entry
 */

const waitlistService = require('./waitlist.service');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');

const createEntry = async (req, res, next) => {
  try {
    // Honeypot: if the hidden `website` field was filled, this is a bot.
    // Respond 201 like a normal success so the bot moves on; don't persist.
    if (req.body.website && req.body.website.trim() !== '') {
      logger.info('Waitlist honeypot triggered - silently dropped', { ip: req.ip });
      return res.status(201).json(
        ApiResponse.success(
          "You're on the list - we'll text you when the app goes live.",
          { id: null },
        ),
      );
    }

    // Trust the proxy chain to set req.ip / req.ips. The Express setting is
    // configured globally in app.js when behind nginx.
    const entry = await waitlistService.createEntry(req.body, {
      ipAddress: (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 500),
    });

    res.status(201).json(
      ApiResponse.success(
        "You're on the list - we'll text you when the app goes live.",
        { id: entry.id },
      ),
    );
  } catch (err) {
    next(err);
  }
};

const adminListEntries = async (req, res, next) => {
  try {
    const { entries, total, page, limit } = await waitlistService.listEntries(req.query);
    res.json(ApiResponse.paginated('Waitlist entries', entries, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const adminSummary = async (_req, res, next) => {
  try {
    const data = await waitlistService.summary();
    res.json(ApiResponse.success('Waitlist summary', data));
  } catch (err) {
    next(err);
  }
};

const adminDeleteEntry = async (req, res, next) => {
  try {
    await waitlistService.deleteEntry(req.params.id);
    res.json(ApiResponse.success('Entry removed', null));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createEntry,
  adminListEntries,
  adminSummary,
  adminDeleteEntry,
};
