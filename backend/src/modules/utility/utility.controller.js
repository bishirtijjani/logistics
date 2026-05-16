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

const getDataPlans = async (req, res, next) => {
  try {
    const plans = await utilityService.getPlans({ ...req.query, type: 'DATA' });
    res.json(ApiResponse.success('Data plans fetched', plans));
  } catch (error) {
    next(error);
  }
};

const getNetworks = async (req, res, next) => {
  try {
    const networks = await utilityService.getNetworks(req.query);
    res.json(ApiResponse.success('Networks fetched', networks));
  } catch (error) {
    next(error);
  }
};

const getDiscos = async (req, res, next) => {
  try {
    const discos = await utilityService.getDiscos();
    res.json(ApiResponse.success('DISCOs fetched', discos));
  } catch (error) {
    next(error);
  }
};

const detectNetwork = async (req, res, next) => {
  try {
    const result = await utilityService.detectNetwork(req.body);
    res.json(ApiResponse.success('Network detected', result));
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
    // Accept both GET (query) and POST (body) per Phase 7 spec.
    const input = req.method === 'POST' ? req.body : req.query;
    const result = await utilityService.validateMeter(input);
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

const getPayment = async (req, res, next) => {
  try {
    const payment = await utilityService.getPayment(req.user.id, req.params.id);
    if (!payment) {
      return res.status(404).json(ApiResponse.error('Payment not found'));
    }
    res.json(ApiResponse.success('Payment fetched', payment));
  } catch (error) {
    next(error);
  }
};

const getRecentRecipients = async (req, res, next) => {
  try {
    const list = await utilityService.getRecentRecipients(req.user.id, req.query);
    res.json(ApiResponse.success('Recent recipients', list));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlans,
  getDataPlans,
  getNetworks,
  getDiscos,
  detectNetwork,
  buyAirtime,
  buyData,
  buyCable,
  payElectricity,
  validateIuc,
  validateMeter,
  getBillHistory,
  getPayment,
  getRecentRecipients,
};
