/**
 * Delivery API service - customer app.
 */
const api = require('../../services/api');

const estimateFare = (params) => api.get('/delivery/estimate', { params });
const createOrder = (data) => api.post('/delivery/orders', data);
const getOrders = (params) => api.get('/delivery/orders', { params });
const getOrder = (orderId) => api.get(`/delivery/orders/${orderId}`);
const rateDelivery = (orderId, data) => api.post(`/delivery/orders/${orderId}/rate`, data);

module.exports = { estimateFare, createOrder, getOrders, getOrder, rateDelivery };
