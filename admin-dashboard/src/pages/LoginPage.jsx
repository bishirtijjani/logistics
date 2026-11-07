import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/slices/authSlice'
import api from '../lib/api'
import { ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password })
      const { user, tokens } = response.data.data

      if (user.role !== 'ADMIN') {
        setError('Access denied. Admin only.')
        setLoading(false)
        return
      }

      dispatch(setCredentials({ user, token: tokens.accessToken, refreshToken: tokens.refreshToken }))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (error) setError('')
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (error) setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-surface-muted dark:from-dark-background dark:to-dark-surface-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface dark:bg-dark-surface rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/60 dark:bg-primary/20 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-secondary dark:text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">Logistics Platform Admin</h1>
          <p className="text-muted dark:text-dark-muted mt-2">Sign in to the admin dashboard</p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 text-error px-4 py-3 rounded-lg mb-6"
          >
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
              onChange={handleEmailChange}
              required
              className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-text dark:text-dark-text"
              placeholder="admin@"
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
                onChange={handlePasswordChange}
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
      </div>
    </div>
  )
}
