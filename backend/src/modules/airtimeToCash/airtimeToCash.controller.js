const airtimeToCashService = require('./airtimeToCash.service');
const { ApiResponse } = require('../../utils/api-response');

const initiate = async (req, res, next) => {
  try {
    const result = await airtimeToCashService.initiate(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('OTP sent', result));
  } catch (err) {
    next(err);
  }
};

const verify = async (req, res, next) => {
  try {
    const result = await airtimeToCashService.verify(req.user.id, req.body);
    res.json(ApiResponse.success('OTP verified', result));
  } catch (err) {
    next(err);
  }
};

const submit = async (req, res, next) => {
  try {
    const result = await airtimeToCashService.submit(req.user.id, req.body);
    res.json(ApiResponse.success('Transfer submitted', result));
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const result = await airtimeToCashService.getHistory(req.user.id, req.query);
    res.json(ApiResponse.success('History fetched', result));
  } catch (err) {
    next(err);
  }
};

const getTransaction = async (req, res, next) => {
  try {
    const tx = await airtimeToCashService.getTransaction(req.user.id, req.params.id);
    res.json(ApiResponse.success('Transaction fetched', tx));
  } catch (err) {
    next(err);
  }
};

const getConfig = async (_req, res, next) => {
  try {
    const config = await airtimeToCashService.getConfig();
    res.json(ApiResponse.success('Config fetched', config));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  initiate,
  verify,
  submit,
  getHistory,
  getTransaction,
  getConfig,
};
