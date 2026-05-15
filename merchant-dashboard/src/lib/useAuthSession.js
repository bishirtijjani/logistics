import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout, refreshToken as refreshTokenThunk } from '../store/slices/authSlice'

const WARNING_MS = 5 * 60 * 1000 // 5 minutes before expiry
const POLL_MS = 60 * 1000        // re-check expiry every minute

/**
 * Decode the exp claim out of a JWT without verifying the signature. We only
 * use this to drive the client-side countdown — the server is still the
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
 * Session lifecycle hook for the merchant dashboard. Surfaces a 5-min
 * warning before the access token expires, drives a silent refresh via the
 * existing /auth/refresh endpoint (so the merchant rarely sees the modal),
 * and force-logs them out when the token is dead.
 *
 * `extendSession` returns a boolean so callers can react to refresh failure
 * (e.g. show a "couldn't extend, please sign in again" toast).
 */
export const useAuthSession = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [extending, setExtending] = useState(false)
  const loggedOutRef = useRef(false)

  const handleLogout = useCallback(async () => {
    if (loggedOutRef.current) return
    loggedOutRef.current = true
    setShowWarning(false)
    await dispatch(logout())
    navigate('/login')
  }, [dispatch, navigate])

  const extendSession = useCallback(async () => {
    setExtending(true)
    try {
      await dispatch(refreshTokenThunk()).unwrap()
      setShowWarning(false)
      return true
    } catch {
      // Refresh failed (refresh token expired/revoked). Force the user back
      // to login rather than leaving them in a half-authenticated state.
      await handleLogout()
      return false
    } finally {
      setExtending(false)
    }
  }, [dispatch, handleLogout])

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const expiry = getTokenExpiryMs()
      if (!expiry) {
        setTimeRemaining(null)
        return
      }
      const remaining = expiry - Date.now()
      setTimeRemaining(remaining)
      if (remaining <= 0) {
        handleLogout()
        return
      }
      if (remaining <= WARNING_MS) {
        setShowWarning(true)
      }
    }

    tick()
    const interval = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [handleLogout])

  return {
    timeRemaining,
    showWarning,
    extending,
    formatTimeRemaining,
    handleLogout,
    extendSession,
  }
}

const formatTimeRemaining = (ms) => {
  if (ms == null || ms <= 0) return null
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}
