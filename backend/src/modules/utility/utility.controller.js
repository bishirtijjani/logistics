const utilityService = require('./utility.service');
const authService = require('../auth/auth.service');
const { ApiResponse } = require('../../utils/api-response');

const getPlans = async (req, res, next) => {
  try {
    const plans = await utilityService.getPlans(req.query);
    res.json(ApiResponse.success('Plans fetched', plans));
  } catch (error) {
    next(error);
  }
};

const buyAirtime = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await utilityService.buyAirtime(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Airtime purchase processing', result));
  } catch (error) {
    next(error);
  }
};

const buyData = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await utilityService.buyData(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Data purchase processing', result));
  } catch (error) {
    next(error);
  }
};

const buyCable = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await utilityService.buyCable(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Cable subscription processing', result));
  } catch (error) {
    next(error);
  }
};

const payElectricity = async (req, res, next) => {
  try {
    await authService.verifyTransactionPin(req.user.id, req.body.pin);
    const result = await utilityService.payElectricity(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Electricity payment processing', result));
  } catch (error) {
    next(error);
  }
};

const validateIuc = async (req, res, next) => {
  try {
    const result = await utilityService.validateIuc(req.query);
    res.json(ApiResponse.success('IUC validated', result));
  } catch (error) {
    next(error);
  }
};

const validateMeter = async (req, res, next) => {
  try {
    const result = await utilityService.validateMeter(req.query);
    res.json(ApiResponse.success('Meter validated', result));
  } catch (error) {
    next(error);
  }
};

const getBillHistory = async (req, res, next) => {
  try {
    const { payments, total, page, limit } = await utilityService.getBillHistory(req.user.id, req.query);
    res.json(ApiResponse.paginated('Bill history', payments, page, limit, total));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlans,
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  validateIuc,
  validateMeter,
  getBillHistory,
};
