import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import { useNavigate } from 'react-router-dom'

export const useAuthSession = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [showWarning, setShowWarning] = useState(false)

  const getTokenExpiry = () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return null
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 // Convert to milliseconds
    } catch (e) {
      return null
    }
  }

  const checkSession = () => {
    const expiry = getTokenExpiry()
    if (!expiry) return

    const now = Date.now()
    const remaining = expiry - now
    setTimeRemaining(remaining)

    // Show warning 5 minutes before expiry
    if (remaining <= 5 * 60 * 1000 && remaining > 0 && !showWarning) {
      setShowWarning(true)
    }

    // Auto-logout if expired
    if (remaining <= 0) {
      handleLogout()
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
    setShowWarning(false)
  }

  const extendSession = () => {
    setShowWarning(false)
    // Note: This would need backend support for token refresh
    // For now, just hide the warning
  }

  useEffect(() => {
    // Check immediately
    checkSession()

    // Check every minute
    const interval = setInterval(checkSession, 60000)

    return () => clearInterval(interval)
  }, [])

  const formatTimeRemaining = (ms) => {
    if (!ms) return null
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  return {
    timeRemaining,
    showWarning,
    formatTimeRemaining,
    handleLogout,
    extendSession,
  }
}
