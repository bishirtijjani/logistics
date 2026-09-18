import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../store/slices/authSlice.js'
import { Store, Lock, Eye, EyeOff, Check } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState('request')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotPassword, setForgotPassword] = useState('')
  const [forgotConfirm, setForgotConfirm] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading } = useSelector((state) => state.auth)

  // Auto-fill email if remember me was checked
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email')
    const rememberMeChecked = localStorage.getItem('remember_me') === 'true'
    
    if (savedEmail && rememberMeChecked) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  // Resend countdown for the reset code - mirrors the server's 60s OTP cooldown
  // so we don't fire a request that is guaranteed to 429.
  useEffect(() => {
    if (forgotResendCooldown <= 0) return
    const timer = setTimeout(() => setForgotResendCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [forgotResendCooldown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      // rememberMe is purely client-side (localStorage below) - the thunk
      // ignores it, so don't pass it along and pretend it's part of the API.
      const result = await dispatch(login({ email, password })).unwrap()
      
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true')
        localStorage.setItem('saved_email', email)
      } else {
        localStorage.removeItem('remember_me')
        localStorage.removeItem('saved_email')
      }
      
      if (result.user.merchantId) {
        navigate('/dashboard')
      } else {
        // Valid iPrime login but no merchant profile yet. Instead of logging
        // them back out, keep the session and send them to merchant enrollment
        // so an existing customer/rider can add a merchant profile to the same
        // account - no second email, same wallet. ProtectedRoute applies the
        // same gate on refresh, so a live token alone can't reach the dashboard.
        navigate('/enroll')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    }
  }

  // The backend emails a 6-digit OTP and expects it back via
  // /auth/password/reset - there is no reset *link*. Keep the request generic
  // ("if an account exists...") so we never leak which emails are registered.
  const requestResetCode = async () => {
    setForgotError('')
    setForgotLoading(true)
    try {
      await api.post('/auth/password/forgot', { email: forgotEmail })
      setForgotCode('')
      setForgotPassword('')
      setForgotConfirm('')
      setForgotStep('reset')
      setForgotResendCooldown(60)
    } catch (err) {
      setForgotError(
        err?.response?.data?.message ||
          (err?.code === 'ERR_NETWORK'
            ? "Can't reach the server. Check your connection and try again."
            : 'Failed to send reset code. Please try again.')
      )
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotPassword = (e) => {
    e.preventDefault()
    requestResetCode()
  }

  const handleResendCode = () => {
    if (forgotResendCooldown > 0 || forgotLoading) return
    requestResetCode()
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setForgotError('')

    if (forgotCode.length !== 6) {
      setForgotError('Enter the 6-digit code we emailed you.')
      return
    }
    if (forgotPassword.length < 8) {
      setForgotError('Your new password must be at least 8 characters.')
      return
    }
    if (forgotPassword !== forgotConfirm) {
      setForgotError("Those passwords don't match. Please re-enter them.")
      return
    }

    setForgotLoading(true)
    try {
      await api.post('/auth/password/reset', {
        email: forgotEmail,
        code: forgotCode,
        newPassword: forgotPassword,
      })
      setEmail(forgotEmail)
      setForgotStep('done')
    } catch (err) {
      setForgotError(
        err?.response?.data?.message ||
          (err?.code === 'ERR_NETWORK'
            ? "Can't reach the server. Check your connection and try again."
            : 'Failed to reset your password. Please try again.')
      )
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotPassword = () => {
    setShowForgotPassword(false)
    setForgotStep('request')
    setForgotEmail('')
    setForgotCode('')
    setForgotPassword('')
    setForgotConfirm('')
    setForgotError('')
    setForgotResendCooldown(0)
    setShowNewPassword(false)
  }

  const openForgotPassword = () => {
    setError('')
    setForgotError('')
    setForgotStep('request')
    setShowForgotPassword(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-surface-muted dark:from-dark-background dark:to-dark-surface-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface dark:bg-dark-surface rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">Merchant Dashboard</h1>
          <p className="text-muted dark:text-dark-muted mt-2">Sign in to manage your store</p>
        </div>

        {error && (
          <div className="px-4 py-3 mb-6 rounded-lg bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 text-error">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-text dark:text-dark-text"
              placeholder="merchant@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition pr-12 text-text dark:text-dark-text"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary border-surface-muted dark:border-dark-surface-muted rounded focus:ring-primary dark:focus:ring-primary/50 dark:focus:ring-offset-dark-surface"
              />
              <span className="text-sm text-muted dark:text-dark-muted">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted dark:text-dark-muted">
          <button
            type="button"
            onClick={openForgotPassword}
            className="text-primary hover:text-primary-700 dark:hover:text-primary-400 font-medium"
          >
            Forgot your password?
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-muted dark:text-dark-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:text-primary-700 dark:hover:text-primary-400 font-semibold">
            Register as a Merchant
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={closeForgotPassword}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-xl p-6 sm:p-8 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
                {forgotStep === 'done' ? (
                  <Check className="w-6 h-6 text-success" />
                ) : (
                  <Lock className="w-6 h-6 text-primary" />
                )}
              </div>
              <h2 id="forgot-password-title" className="text-xl font-bold text-text dark:text-dark-text">
                {forgotStep === 'request' && 'Reset Password'}
                {forgotStep === 'reset' && 'Enter Reset Code'}
                {forgotStep === 'done' && 'Password Reset'}
              </h2>
              <p className="text-muted dark:text-dark-muted mt-2">
                {forgotStep === 'request' &&
                  "Enter your email address and we'll send you a 6-digit reset code"}
                {forgotStep === 'reset' &&
                  `We emailed a 6-digit code to ${forgotEmail}. Enter it below and choose a new password.`}
                {forgotStep === 'done' &&
                  'Your password has been updated. Sign in with your new password.'}
              </p>
            </div>

            {forgotError && (
              <div className="bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 text-error px-4 py-3 rounded-lg mb-6">
                {forgotError}
              </div>
            )}

            {forgotStep === 'request' && (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                    placeholder="merchant@example.com"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="flex-1 px-4 py-3 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Code'
                    )}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <label htmlFor="forgot-code" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Reset Code
                  </label>
                  <input
                    id="forgot-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                    placeholder="000000"
                  />
                </div>

                <div>
                  <label htmlFor="forgot-new-password" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={forgotPassword}
                      onChange={(e) => setForgotPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition pr-12 text-text dark:text-dark-text"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="forgot-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                    placeholder="Re-enter your new password"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={forgotResendCooldown > 0 || forgotLoading}
                  className="w-full text-sm text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forgotResendCooldown > 0
                    ? `Resend code in ${forgotResendCooldown}s`
                    : "Didn't get the code? Resend"}
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="flex-1 px-4 py-3 border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-6">
                <div className="bg-success/10 dark:bg-success/20 border border-success/20 dark:border-success/30 text-success px-4 py-3 rounded-lg">
                  Your password has been reset successfully.
                </div>
                <button
                  onClick={closeForgotPassword}
                  className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
