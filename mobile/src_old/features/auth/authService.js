/**
 * Auth API service - customer app.
 */
const api = require('../../services/api');

const login = (data) => api.post('/auth/login', data);
const register = (data) => api.post('/auth/register', data);
const refreshToken = (data) => api.post('/auth/refresh', data);
const setPin = (data) => api.post('/auth/pin', data);
const logout = (data) => api.post('/auth/logout', data);

module.exports = { login, register, refreshToken, setPin, logout };
