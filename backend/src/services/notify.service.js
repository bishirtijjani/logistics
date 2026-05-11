/**
 * Centralized notification service — fans out to socket and (optionally) FCM.
 *
 * All wallet events and order lifecycle events must go through here.
 * Never emit sockets directly from service/worker files.
 */

const { logger } = require('../utils/logger');
const { WALLET } = require('../sockets/events');

let _io = null;

const setIO = (io) => { _io = io; };
const getIO = () => _io;

/**
 * Emit a wallet balance update to a user's personal room.
 */
const balanceUpdated = (userId, { balance, transaction }) => {
  if (!_io) return;
  try {
    _io.to(`user:${userId}`).emit(WALLET.BALANCE_UPDATED, { balance, transaction });
  } catch (err) {
    logger.warn('Socket emit failed (balanceUpdated)', { userId, error: String(err) });
  }
};

/**
 * Emit a transfer-received event to the recipient.
 */
const transferReceived = (userId, { amount, senderName, reference }) => {
  if (!_io) return;
  try {
    _io.to(`user:${userId}`).emit('wallet:transfer:received', { amount, senderName, reference });
  } catch (err) {
    logger.warn('Socket emit failed (transferReceived)', { userId, error: String(err) });
  }
};

/**
 * Emit a wallet funding event to the user.
 */
const fundingReceived = (userId, { amount, reference }) => {
  if (!_io) return;
  try {
    _io.to(`user:${userId}`).emit('wallet:funding:received', { amount, reference });
  } catch (err) {
    logger.warn('Socket emit failed (fundingReceived)', { userId, error: String(err) });
  }
};

module.exports = { setIO, getIO, balanceUpdated, transferReceived, fundingReceived };
