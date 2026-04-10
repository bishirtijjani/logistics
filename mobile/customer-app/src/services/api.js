import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

// Load base URL from environment variables, fallback for local dev
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: basic error unwrapping
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'Network Error. Please check your connection.';
    if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }

    // Globally trigger the toast!
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: message,
      position: 'top',
    });

    return Promise.reject(new Error(message));
  }
);

export default api;
