/**
 * Delivery controller — HTTP handlers for delivery routes.
 */

const deliveryService = require('./delivery.service');
const { ApiResponse } = require('../../utils/api-response');

const estimateFare = async (req, res, next) => {
  try {
    const estimate = await deliveryService.estimateFare(req.query);
    res.json(ApiResponse.success('Fare estimate', estimate));
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const order = await deliveryService.createOrder(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Delivery order created', order));
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await deliveryService.updateStatus(
      req.params.orderId,
      req.body.status,
      req.user.id,
      req.body.cancellationReason
    );
    res.json(ApiResponse.success('Delivery status updated', order));
  } catch (error) {
    next(error);
  }
};

const rateDelivery = async (req, res, next) => {
  try {
    const rating = await deliveryService.rateDelivery(
      req.params.orderId,
      req.user.id,
      req.body
    );
    res.status(201).json(ApiResponse.success('Rating submitted', rating));
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { orders, total, page, limit } = await deliveryService.getOrders(
      req.user.id,
      req.user.role,
      req.query
    );
    res.json(ApiResponse.paginated('Delivery orders', orders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await deliveryService.getOrderById(
      req.params.orderId,
      req.user.id,
      req.user.role
    );
    res.json(ApiResponse.success('Order details', order));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  estimateFare,
  createOrder,
  updateStatus,
  rateDelivery,
  getOrders,
  getOrder,
};
