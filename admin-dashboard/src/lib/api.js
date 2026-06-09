import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      window.location.href = '/login'
    }

    // Surface the backend's helpful message (e.g. "Category with slug
    // 'furniture' already exists") in place of axios's generic "Request failed
    // with status code 409". We overwrite `.message` on the existing AxiosError
    // rather than throwing a fresh Error so `.response`/`.config` stay intact
    // for callers that read `err.response.data.message` directly - while fixing
    // the many that read `err.message` (via thunk `.unwrap()`) or the rejected
    // action's `r.error.message`. Network failures keep axios's own message.
    const backendMessage = error.response?.data?.message
    if (backendMessage) error.message = backendMessage

    return Promise.reject(error)
  }
)

export default api
