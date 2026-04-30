import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../store/slices/authSlice'
import api from '../lib/api'
import { Eye, EyeOff } from 'lucide-react'

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
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password })
      const { user, tokens } = response.data.data
      
      if (user.role !== 'ADMIN') {
        setError('Access denied. Admin only.')
        return
      }

      dispatch(setCredentials({ user, token: tokens.accessToken }))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-secondary">VTU Logistics</h1>
          <p className="text-muted mt-2">Admin Dashboard</p>
        </div>

        <div className="bg-surface rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-secondary mb-6">Sign In</h2>
          
          {error && (
            <div className="bg-red-50 text-error p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="admin@vtulogistics.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1">
               d v className="relative">
                <iPassword
              </  label>
              <i  nput{showPassword ? 'text' : ''}
                  id="password"
                  type="password"
                  value={password}pr-10 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                 >
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
