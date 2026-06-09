/**
 * Utilities API service - customer app.
 */
const api = require('../../services/api');

const buyAirtime = (data) => api.post('/utilities/airtime', data);
const buyData = (data) => api.post('/utilities/data', data);
const payElectricity = (data) => api.post('/utilities/electricity', data);
const getBillHistory = (params) => api.get('/utilities/history', { params });

module.exports = { buyAirtime, buyData, payElectricity, getBillHistory };
