import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout, refreshToken } from '../store/slices/authSlice.js'
import { showErrorToast, showWarningToast } from '../utils/toast.js'

const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const WARNING_TIMEOUT = 5 * 60 * 1000 // 5 minutes before logout
const TOKEN_REFRESH_INTERVAL = 25 * 60 * 1000 // Refresh token every 25 minutes

export function useSessionManager() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { isAuthenticated, token } = useSelector((state) => state.auth)
  
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(SESSION_TIMEOUT)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const activityTimeoutRef = useRef(null)
  const warningTimeoutRef = useRef(null)
  const logoutTimeoutRef = useRef(null)
  const refreshIntervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // Clear existing timers
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current)
    
    // Set new timers
    activityTimeoutRef.current = setTimeout(() => {
      handleLogout()
    }, SESSION_TIMEOUT)
    
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setTimeLeft(WARNING_TIMEOUT)
    }, SESSION_TIMEOUT - WARNING_TIMEOUT)
  }, [])

  const handleUserActivity = useCallback(() => {
    if (isAuthenticated) {
      resetActivityTimer()
      if (showWarning) {
        setShowWarning(false)
      }
    }
  }, [isAuthenticated, resetActivityTimer, showWarning])

  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap()
      navigate('/login')
      showErrorToast('Session expired. Please log in again.')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [dispatch, navigate])

  const handleStayLoggedIn = useCallback(async () => {
    setShowWarning(false)
    await refreshAuthToken()
    resetActivityTimer()
  }, [resetActivityTimer])

  const refreshAuthToken = useCallback(async () => {
    if (!token || isRefreshing) return
    
    setIsRefreshing(true)
    try {
      await dispatch(refreshToken()).unwrap()
    } catch (error) {
      console.error('Token refresh failed:', error)
      await handleLogout()
    } finally {
      setIsRefreshing(false)
    }
  }, [token, isRefreshing, dispatch, handleLogout])

  const logoutAllDevices = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        await handleLogout()
        showWarningToast('Logged out from all devices successfully')
      }
    } catch (error) {
      console.error('Logout all devices error:', error)
      showErrorToast('Failed to logout from all devices')
    }
  }, [token, handleLogout])

  // Setup activity listeners
  useEffect(() => {
    if (!isAuthenticated) return

    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'keydown', 'keyup'
    ]

    const handleActivity = () => handleUserActivity()

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Setup token refresh interval
    refreshIntervalRef.current = setInterval(() => {
      refreshAuthToken()
    }, TOKEN_REFRESH_INTERVAL)

    // Initial timer setup
    resetActivityTimer()

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current)
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [isAuthenticated, handleUserActivity, resetActivityTimer, refreshAuthToken])

  // Warning countdown timer
  useEffect(() => {
    if (!showWarning) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          handleLogout()
          return 0
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [showWarning, handleLogout])

  // Format time for display
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.ceil(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return {
    showWarning,
    timeLeft,
    formatTime,
    handleStayLoggedIn,
    handleLogout,
    logoutAllDevices,
    isRefreshing
  }
}
