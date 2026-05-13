import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchSettings, updateSettings } from '../store/slices/settingsSlice.js'
import { Store, Save, Bell, Clock, Lock, Eye, EyeOff, Smartphone } from 'lucide-react'
import { CardSkeleton } from '../components/LoadingSkeleton.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'

export default function SettingsPage() {
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  const dispatch = useDispatch()
  const { settings, loading } = useSelector((state) => state.settings)
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    lat: 0,
    lng: 0,
    openingTime: '08:00',
    closingTime: '22:00',
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newOrderAlerts: true,
    orderStatusAlerts: true,
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [loginHistory, setLoginHistory] = useState([])
  const [devices, setDevices] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const checkPasswordStrength = (password) => {
    let strength = 0
    
    // Length check
    if (password.length >= 8) strength += 1
    if (password.length >= 12) strength += 1
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength += 1  // Lowercase
    if (/[A-Z]/.test(password)) strength += 1  // Uppercase
    if (/[0-9]/.test(password)) strength += 1  // Numbers
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1  // Special characters
    
    return Math.min(strength, 5)
  }

  const getPasswordStrengthColor = (strength) => {
    const colors = [
      'bg-red-500',
      'bg-orange-500', 
      'bg-yellow-500',
      'bg-blue-500',
      'bg-green-500'
    ]
    return colors[strength] || 'bg-gray-300'
  }

  const getPasswordStrengthText = (strength) => {
    const texts = [
      'Very Weak',
      'Weak',
      'Fair',
      'Good',
      'Strong'
    ]
    return texts[strength] || 'Very Weak'
  }

  useEffect(() => {
    dispatch(fetchSettings({ merchantId }))
  }, [dispatch, merchantId])

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name || '',
        description: settings.description || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        lat: typeof settings.lat === 'number' ? settings.lat : 0,
        lng: typeof settings.lng === 'number' ? settings.lng : 0,
        openingTime: settings.openingTime || '08:00',
        closingTime: settings.closingTime || '22:00',
      })
      setNotificationSettings({
        emailNotifications: settings.emailNotifications ?? true,
        pushNotifications: settings.pushNotifications ?? true,
        newOrderAlerts: settings.newOrderAlerts ?? true,
        orderStatusAlerts: settings.orderStatusAlerts ?? true,
      })
    }
  }, [settings])

  useEffect(() => {
    if (activeTab === 'history') {
      fetchLoginHistory()
      fetchDevices()
    }
  }, [activeTab])

  const fetchLoginHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/merchants/${merchantId}/login-history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setLoginHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to fetch login history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchDevices = async () => {
    try {
      const response = await fetch(`/api/merchants/${merchantId}/devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error)
    }
  }

  const removeDevice = async (deviceId) => {
    try {
      const response = await fetch(`/api/merchants/${merchantId}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        showSuccessToast('Device removed successfully')
        fetchDevices()
      }
    } catch (error) {
      showErrorToast('Failed to remove device')
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    try {
      await dispatch(updateSettings({
        merchantId,
        ...formData,
      })).unwrap()
      showSuccessToast('Profile updated successfully')
    } catch (err) {
      console.error('Failed to update profile:', err)
      showErrorToast('Failed to update profile')
    }
  }

  const handleNotificationSave = async (e) => {
    e.preventDefault()
    try {
      await dispatch(updateSettings({
        merchantId,
        ...notificationSettings,
      })).unwrap()
      showSuccessToast('Notification settings updated successfully')
    } catch (err) {
      console.error('Failed to update notification settings:', err)
      showErrorToast('Failed to update notification settings')
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    // Validate current password
    if (!passwordData.currentPassword) {
      showErrorToast('Please enter your current password')
      return
    }
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showErrorToast('New passwords do not match')
      return
    }

    // Validate password strength (minimum strength of 2/5)
    if (passwordStrength < 2) {
      showErrorToast('Password is too weak. Please use a stronger password with mixed characters.')
      return
    }

    // Validate password is not the same as current
    if (passwordData.currentPassword === passwordData.newPassword) {
      showErrorToast('New password must be different from current password')
      return
    }

    try {
      // Call password change API
      const response = await fetch(`/api/merchants/${merchantId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to change password')
      }

      // Reset form and strength indicator
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordStrength(0)
      
      showSuccessToast('Password updated successfully!')
    } catch (err) {
      console.error('Failed to update password:', err)
      if (err.message.includes('current password')) {
        showErrorToast('Current password is incorrect. Please try again.')
      } else {
        showErrorToast('Failed to update password. Please try again.')
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Settings</h1>
        <p className="text-muted dark:text-dark-muted">Manage your merchant profile and preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-muted dark:border-dark-surface-muted dark:border-dark-surface-muted">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 border-b-2 font-medium transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-4 border-b-2 font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-4 border-b-2 font-medium transition-colors ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
            }`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 border-b-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
            }`}
          >
            Login History
          </button>
        </nav>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : activeTab === 'profile' && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text dark:text-dark-text">Profile Information</h2>
                <p className="text-sm text-muted dark:text-dark-muted">Update your merchant profile details</p>
              </div>
            </div>

            {settings?.category && (
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-surface-muted dark:border-dark-surface-muted p-4">
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0"
                  style={{ background: settings.category.color || '#7C3AED' }}
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
                    Business Category
                  </p>
                  <p className="text-sm font-semibold text-text dark:text-dark-text">
                    {settings.category.name}
                  </p>
                  <p className="text-xs text-muted dark:text-dark-muted">
                    Contact admin to change your category.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Business Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">Location</label>
              <LocationPicker
                value={{ address: formData.address, lat: formData.lat, lng: formData.lng }}
                onChange={({ address, lat, lng }) => setFormData({ ...formData, address, lat, lng })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Opening Time</label>
                <input
                  type="time"
                  value={formData.openingTime}
                  onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Closing Time</label>
                <input
                  type="time"
                  value={formData.closingTime}
                  onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                  className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <form onSubmit={handleNotificationSave} className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">Notification Preferences</h2>
                <p className="text-sm text-muted">Configure how you receive notifications</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
                <div>
                  <p className="font-medium text-text">Email Notifications</p>
                  <p className="text-sm text-muted">Receive notifications via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      emailNotifications: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted dark:border-dark-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
                <div>
                  <p className="font-medium text-text">Push Notifications</p>
                  <p className="text-sm text-muted">Receive push notifications in browser</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.pushNotifications}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      pushNotifications: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted dark:border-dark-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
                <div>
                  <p className="font-medium text-text">New Order Alerts</p>
                  <p className="text-sm text-muted">Get notified when new orders arrive</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.newOrderAlerts}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      newOrderAlerts: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted dark:border-dark-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
                <div>
                  <p className="font-medium text-text">Order Status Alerts</p>
                  <p className="text-sm text-muted">Get notified when order status changes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.orderStatusAlerts}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      orderStatusAlerts: e.target.checked,
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted dark:border-dark-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text">Password Management</h2>
              <p className="text-sm text-muted dark:text-dark-muted">Update your account password</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted dark:border-dark-surface-muted bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-text dark:text-dark-text"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                    setPasswordStrength(checkPasswordStrength(e.target.value))
                  }}
                  className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted dark:border-dark-surface-muted bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-text dark:text-dark-text"
                  required
                  minLength="8"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {passwordData.newPassword && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted dark:text-dark-muted">
                      Password Strength: {getPasswordStrengthText(passwordStrength)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-muted dark:bg-dark-surface-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted dark:text-dark-muted">
                    <p>Use a mix of uppercase, lowercase, numbers, and special characters for a strong password.</p>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Password must be at least 8 characters long</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-surface-muted dark:border-dark-surface-muted dark:border-dark-surface-muted bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-text dark:text-dark-text"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Login History */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text dark:text-dark-text">Login History</h2>
                <p className="text-sm text-muted dark:text-dark-muted">Recent login attempts and locations</p>
              </div>
            </div>

            {loadingHistory ? (
              <CardSkeleton />
            ) : loginHistory.length > 0 ? (
              <div className="space-y-3">
                {loginHistory.map((login, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        login.success ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium text-text dark:text-dark-text">
                          {login.success ? 'Successful Login' : 'Failed Login'}
                        </p>
                        <p className="text-sm text-muted dark:text-dark-muted">
                          {new Date(login.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted dark:text-muted">
                          IP: {login.ipAddress} • {login.location}
                        </p>
                        <p className="text-xs text-muted dark:text-muted">
                          {login.device} • {login.browser}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted dark:text-dark-muted">
                No login history available
              </div>
            )}
          </div>

          {/* Device Management */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text dark:text-dark-text">Active Devices</h2>
                <p className="text-sm text-muted dark:text-dark-muted">Manage devices with access to your account</p>
              </div>
            </div>

            {devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map((device, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        device.current ? 'bg-green-500' : 'bg-muted'
                      }`} />
                      <div>
                        <p className="font-medium text-text dark:text-dark-text">
                          {device.deviceName}
                          {device.current && <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded">Current</span>}
                        </p>
                        <p className="text-sm text-muted dark:text-dark-muted">
                          Last active: {new Date(device.lastActive).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted dark:text-muted">
                          {device.location} • {device.ipAddress}
                        </p>
                      </div>
                    </div>
                    {!device.current && (
                      <button
                        onClick={() => removeDevice(device.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted dark:text-dark-muted">
                No active devices found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
