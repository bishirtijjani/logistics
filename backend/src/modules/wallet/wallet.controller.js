const walletService = require('./wallet.service');
const authService = require('../auth/auth.service');
const katpayService = require('../../services/katpay.service');
const { ApiResponse } = require('../../utils/api-response');

const getWallet = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
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

const lookupBankAccount = async (req, res, next) => {
  try {
    const { bankCode, accountNumber } = req.body;
    const result = await walletService.lookupBankAccount({ bankCode, accountNumber });
    res.json(ApiResponse.success('Account resolved', result));
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
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const result = await walletService.getTransactionHistory(req.user.id, {
      page: Number(page),
      limit: Number(limit),
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    res.json(ApiResponse.paginated('Transaction history', result.transactions, result.page, result.limit, result.total));
  } catch (error) {
    next(error);
  }
};

const getBeneficiaries = async (req, res, next) => {
  try {
    const beneficiaries = await walletService.getBeneficiaries(req.user.id);
    res.json(ApiResponse.success('Beneficiaries', beneficiaries));
  } catch (error) {
    next(error);
  }
};

const addBeneficiary = async (req, res, next) => {
  try {
    const beneficiary = await walletService.addBeneficiary(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Beneficiary saved', beneficiary));
  } catch (error) {
    next(error);
  }
};

const deleteBeneficiary = async (req, res, next) => {
  try {
    await walletService.deleteBeneficiary(req.user.id, req.params.id);
    res.json(ApiResponse.success('Beneficiary removed'));
  } catch (error) {
    next(error);
  }
};

const getReceipt = async (req, res, next) => {
  try {
    const transaction = await walletService.getTransactionReceipt(req.user.id, req.params.id);
    res.json(ApiResponse.success('Receipt', transaction));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWallet,
  transfer,
  withdraw,
  getBanks,
  lookupBankAccount,
  initiateFunding,
  getTransferPaymentStatus,
  getTransactionHistory,
  getBeneficiaries,
  addBeneficiary,
  deleteBeneficiary,
  getReceipt,
};
