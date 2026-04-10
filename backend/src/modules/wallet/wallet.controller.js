/**
 * Wallet controller — handles HTTP for wallet operations.
 */

const walletService = require('./wallet.service');
const authService = require('../auth/auth.service');
const monnifyService = require('../../services/monnify.service');
const { ApiResponse } = require('../../utils/api-response');

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    res.json(ApiResponse.success('Wallet retrieved', wallet));
  } catch (error) {
    next(error);
  }
};

const transfer = async (req, res, next) => {
  try {
    // Verify PIN before financial operation
    await authService.verifyTransactionPin(req.user.id, req.body.pin);

    const result = await walletService.transfer(req.user.id, req.body);
    res.json(ApiResponse.success('Transfer successful', result));
  } catch (error) {
    next(error);
  }
};

const withdraw = async (req, res, next) => {
  try {
    // Verify PIN before withdrawal
    await authService.verifyTransactionPin(req.user.id, req.body.pin);

    const result = await walletService.withdrawToBank(req.user.id, req.body);
    res.json(ApiResponse.success('Withdrawal processing', result));
  } catch (error) {
    next(error);
  }
};

const verifyAccount = async (req, res, next) => {
  try {
    const result = await monnifyService.verifyAccountName(
      req.query.bankCode,
      req.query.accountNumber
    );
    res.json(ApiResponse.success('Account verified', result));
  } catch (error) {
    next(error);
  }
};

const getTransactionHistory = async (req, res, next) => {
  try {
    const { transactions, total, page, limit } =
      await walletService.getTransactionHistory(req.user.id, req.query);
    res.json(ApiResponse.paginated('Transaction history', transactions, page, limit, total));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWallet,
  transfer,
  withdraw,
  verifyAccount,
  getTransactionHistory,
};
