const walletService = require('./wallet.service');
const authService = require('../auth/auth.service');
const katpayService = require('../../services/katpay.service');
const { ApiResponse } = require('../../utils/api-response');

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    // Map virtual account fields to the names the mobile app expects
    res.json(ApiResponse.success('Wallet retrieved', {
      ...wallet,
      accountNumber: wallet.virtualAccountNumber,
      bankName: wallet.virtualAccountBank,
      accountName: wallet.virtualAccountName,
    }));
  } catch (error) {
    next(error);
  }
};

const transfer = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await walletService.transfer(req.user.id, req.body);
    res.json(ApiResponse.success('Transfer successful', result));
  } catch (error) {
    next(error);
  }
};

const withdraw = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await walletService.withdrawToBank(req.user.id, req.body);
    res.json(ApiResponse.success('Withdrawal processing', result));
  } catch (error) {
    next(error);
  }
};

const getBanks = async (req, res, next) => {
  try {
    const banks = await katpayService.getBankList();
    res.json(ApiResponse.success('Banks retrieved', banks));
  } catch (error) {
    next(error);
  }
};

const initiateFunding = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const result = await walletService.initiateTransferPaymentFunding(req.user.id, { amount });
    res.json(ApiResponse.success('Transfer payment initiated', result));
  } catch (error) {
    next(error);
  }
};

const getTransferPaymentStatus = async (req, res, next) => {
  try {
    const result = await katpayService.getTransferPayment(req.params.uuid);
    res.json(ApiResponse.success('Payment status', result));
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
  getBanks,
  initiateFunding,
  getTransferPaymentStatus,
  getTransactionHistory,
};
