import { useCallback, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from './api'
import { logout, setCredentials } from '../store/slices/authSlice'

// Access tokens live ~15m. Silently refresh once we're inside this buffer of
// the expiry so the user never sees an interruption - the 7-day refresh token
// does the work in the background.
const REFRESH_BUFFER_MS = 3 * 60 * 1000
const POLL_MS = 60 * 1000

const getTokenExpiryMs = () => {
  const token = localStorage.getItem('accessToken')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Session lifecycle hook. Keeps the access token fresh by silently refreshing
 * via /auth/refresh shortly before it expires - no modal, no manual "extend"
 * click. The user only gets bounced to /login when the refresh itself fails
 * (refresh token expired or revoked).
 */
export const useAuthSession = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loggedOutRef = useRef(false)
  // Tracks the token expiry we've already kicked a refresh for, so the 60s
  // poll doesn't fire overlapping /auth/refresh calls for the same token.
  const refreshedForRef = useRef(null)

  const handleLogout = useCallback(() => {
    if (loggedOutRef.current) return
    loggedOutRef.current = true
    dispatch(logout())
    navigate('/login')
  }, [dispatch, navigate])

  const refreshSession = useCallback(async () => {
    const stored = localStorage.getItem('refreshToken')
    if (!stored) {
      handleLogout()
      return
    }
    try {
      const response = await api.post('/auth/refresh', { refreshToken: stored })
      const tokens = response.data?.data
      if (!tokens?.accessToken) throw new Error('Malformed refresh response')
      // Admin's authSlice keeps user identity stable across refresh - only
      // tokens rotate. Reuse setCredentials so both Redux and localStorage
      // pick up the new pair without forcing a re-login.
      const user = JSON.parse(localStorage.getItem('authUser') || 'null')
      dispatch(setCredentials({
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }))
    } catch {
      handleLogout()
    }
  }, [dispatch, handleLogout])

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const expiry = getTokenExpiryMs()
      if (!expiry) return
      const remaining = expiry - Date.now()
      // Refresh proactively near expiry, and reactively if the token already
      // lapsed (e.g. the laptop slept) - the refresh token may still be valid,
      // so try it before giving up. Guarded per-expiry to avoid double-firing.
      if (remaining <= REFRESH_BUFFER_MS && refreshedForRef.current !== expiry) {
        refreshedForRef.current = expiry
        refreshSession()
      }
    }

    tick()
    const interval = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [refreshSession])

  return { handleLogout }
}
