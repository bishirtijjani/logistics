import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from './api'
import { logout, setCredentials } from '../store/slices/authSlice'

const WARNING_MS = 5 * 60 * 1000 // 5 minutes before expiry
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
 * Session lifecycle hook. Surfaces a 5-min warning before the access token
 * expires and offers a silent refresh via /auth/refresh — the stubbed
 * `extendSession` from the original implementation was a no-op.
 */
export const useAuthSession = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [extending, setExtending] = useState(false)
  const loggedOutRef = useRef(false)

  const handleLogout = useCallback(() => {
    if (loggedOutRef.current) return
    loggedOutRef.current = true
    dispatch(logout())
    setShowWarning(false)
    navigate('/login')
  }, [dispatch, navigate])

  const extendSession = useCallback(async () => {
    const stored = localStorage.getItem('refreshToken')
    if (!stored) {
      handleLogout()
      return false
    }
    setExtending(true)
    try {
      const response = await api.post('/auth/refresh', { refreshToken: stored })
      const tokens = response.data?.data
      if (!tokens?.accessToken) throw new Error('Malformed refresh response')
      // Admin's authSlice keeps user identity stable across refresh — only
      // tokens rotate. Reuse setCredentials so both Redux and localStorage
      // pick up the new pair without forcing a re-login.
      const user = JSON.parse(localStorage.getItem('authUser') || 'null')
      dispatch(setCredentials({
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }))
      setShowWarning(false)
      return true
    } catch {
      handleLogout()
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
