const pushService = require('./push.service');
const { ApiResponse } = require('../../utils/api-response');
const { config } = require('../../config');

/**
 * GET /push/public-key — returns the VAPID public key so the browser can build
 * a Push subscription. Public by design (the key is meant to be shared).
 */
const getPublicKey = async (_req, res, next) => {
  try {
    res.json(ApiResponse.success('VAPID public key', { publicKey: config.VAPID_PUBLIC_KEY || null }));
  } catch (err) { next(err); }
};

/** POST /push/subscribe — persist the browser subscription for the user. */
const subscribe = async (req, res, next) => {
  try {
    const result = await pushService.subscribe(req.user.id, req.body || {});
    res.json(ApiResponse.success('Subscribed to web push', result));
  } catch (err) { next(err); }
};

/** POST /push/unsubscribe — remove the browser subscription. */
const unsubscribe = async (req, res, next) => {
  try {
    const result = await pushService.unsubscribe(req.user.id, (req.body || {}).endpoint);
    res.json(ApiResponse.success('Unsubscribed from web push', result));
  } catch (err) { next(err); }
};

module.exports = { getPublicKey, subscribe, unsubscribe };
