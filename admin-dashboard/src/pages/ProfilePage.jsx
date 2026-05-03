import { useState } from 'react'
import { useSelector } from 'react-redux'
import { User, Mail, Lock, Save, Eye, EyeOff } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useSelector((state) => state.auth)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    // TODO: Call API to update profile
    setTimeout(() => {
      setLoading(false)
      setMessage({ type: 'success', text: 'Profile updated successfully' })
    }, 1000)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (formData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    setLoading(true)
    // TODO: Call API to change password
    setTimeout(() => {
      setLoading(false)
      setMessage({ type: 'success', text: 'Password changed successfully' })
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' })
    }, 1000)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Profile Settings</h1>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Information */}
        <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6 flex items-center gap-2">
            <User size={20} />
            Profile Information
          </h2>
          <form onSubmit={handleProfileUpdate}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6 flex items-center gap-2">
            <Lock size={20} />
            Change Password
          </h2>
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text"
                  >
                    {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary dark:bg-dark-surface-muted dark:text-dark-text outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
