/**
 * API service — Axios instance with JWT interceptors.
 *
 * All API calls in the mobile app go through this instance.
 * It automatically attaches the access token and handles token refresh.
 */

const axios = require('axios');
// const AsyncStorage = require('@react-native-async-storage/async-storage');

const API_BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request interceptor: attach access token ---
api.interceptors.request.use(
  async (config) => {
    // TODO: Get token from AsyncStorage or Redux store
    // const token = await AsyncStorage.getItem('accessToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response interceptor: handle 401 + token refresh ---
api.interceptors.response.use(
  (response) => response.data, // Unwrap Axios response, return API response directly
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not a retry, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // TODO: Get refresh token and call /auth/refresh
        // const refreshToken = await AsyncStorage.getItem('refreshToken');
        // const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        // const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        // await AsyncStorage.setItem('accessToken', accessToken);
        // await AsyncStorage.setItem('refreshToken', newRefreshToken);
        // originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        // return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force logout
        // TODO: Dispatch logout action
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

module.exports = api;
