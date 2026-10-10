import axios from 'axios'
import { isNative, requestNativeRefresh } from './nativeBridge'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Public auth endpoints. A 401 from these means "bad credentials" or "bad
// OTP" - NOT "session expired" - so we must NOT hard-redirect; the calling
// page needs to show its inline error. Without this guard the
// window.location.href below kicks off a full page reload that wipes the
// freshly-set error message one frame after it paints, which is why every
// failed sign-in looked like the error was "flashing and disappearing".
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/merchant/register',
  '/auth/password/forgot',
  '/auth/password/reset',
  '/auth/otp/send',
  '/auth/otp/verify',
  '/auth/verify-email',
  '/auth/resend-verification',
]

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      const isPublicAuthCall = PUBLIC_AUTH_PATHS.some((p) => url.includes(p))
      if (!isPublicAuthCall) {
        if (isNative()) {
          // The native shell owns the session and rotating refresh token. Do
          // NOT clear storage or hard-redirect; ask native to refresh + re-inject
          // tokens. The failed request rejects and the UI surfaces the error.
          requestNativeRefresh()
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('merchant_user')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
