import { useCallback, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout, refreshToken as refreshTokenThunk } from '../store/slices/authSlice'

// Access tokens live ~15m. Silently refresh once we're inside this buffer of
// the expiry so the merchant never sees an interruption - the 7-day refresh
// token does the work in the background.
const REFRESH_BUFFER_MS = 3 * 60 * 1000
const POLL_MS = 60 * 1000        // re-check expiry every minute

/**
 * Decode the exp claim out of a JWT without verifying the signature. We only
 * use this to drive the client-side refresh timing - the server is still the
 * authority on whether a token is valid.
 */
const getTokenExpiryMs = () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Session lifecycle hook for the merchant dashboard. Keeps the access token
 * fresh by silently refreshing via /auth/refresh shortly before it expires -
 * no modal, no manual "stay signed in" click. The merchant is only sent back
 * to /login when the refresh itself fails (refresh token expired/revoked).
 */
export const useAuthSession = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loggedOutRef = useRef(false)
  // Tracks the token expiry we've already kicked a refresh for, so the 60s
  // poll doesn't fire overlapping /auth/refresh calls for the same token.
  const refreshedForRef = useRef(null)

  const handleLogout = useCallback(async () => {
    if (loggedOutRef.current) return
    loggedOutRef.current = true
    await dispatch(logout())
    navigate('/login')
  }, [dispatch, navigate])

  const refreshSession = useCallback(async () => {
    try {
      await dispatch(refreshTokenThunk()).unwrap()
    } catch {
      // Refresh failed (refresh token expired/revoked). Force the merchant
      // back to login rather than leaving them half-authenticated.
      await handleLogout()
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
