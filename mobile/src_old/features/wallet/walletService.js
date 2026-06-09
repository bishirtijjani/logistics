/**
 * Wallet API service - customer app.
 */
const api = require('../../services/api');

const getWallet = () => api.get('/wallet');
const transfer = (data) => api.post('/wallet/transfer', data);
const getTransactions = (params) => api.get('/wallet/transactions', { params });

module.exports = { getWallet, transfer, getTransactions };
