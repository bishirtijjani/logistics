import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { User, Mail, Phone, Lock, Bell, Globe, Save, Percent, DollarSign } from 'lucide-react'
import { fetchPlatformSettings, updatePlatformSettings } from '../store/slices/settingsSlice'

export default function SettingsPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { platformSettings, loading } = useSelector((state) => state.settings)
  const [activeTab, setActiveTab] = useState('platform')
  const [saving, setSaving] = useState(false)
  const [platformForm, setPlatformForm] = useState({
    platformName: 'iPrime',
    defaultCurrency: 'NGN',
    timezone: 'Africa/Lagos',
    defaultMerchantCommission: 15,
    defaultRiderCommission: 10,
    minDeliveryFee: 500,
    maxDeliveryFee: 5000,
    supportEmail: 'support@iprime.ng',
    supportPhone: '+2348000000000',
  })
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    newOrderAlerts: true,
    riderStatusAlerts: true,
    paymentAlerts: true,
  })

  useEffect(() => {
    dispatch(fetchPlatformSettings())
  }, [dispatch])

  useEffect(() => {
    if (platformSettings) {
      setPlatformForm({
        platformName: platformSettings.platformName || 'iPrime',
        defaultCurrency: platformSettings.defaultCurrency || 'NGN',
        timezone: platformSettings.timezone || 'Africa/Lagos',
        defaultMerchantCommission: platformSettings.defaultMerchantCommission || 15,
        defaultRiderCommission: platformSettings.defaultRiderCommission || 10,
        minDeliveryFee: platformSettings.minDeliveryFee || 500,
        maxDeliveryFee: platformSettings.maxDeliveryFee || 5000,
        supportEmail: platformSettings.supportEmail || 'support@iprime.ng',
        supportPhone: platformSettings.supportPhone || '+2348000000000',
      })
      setNotificationSettings({
        emailNotifications: platformSettings.emailNotifications ?? true,
        pushNotifications: platformSettings.pushNotifications ?? true,
        smsNotifications: platformSettings.smsNotifications ?? false,
        newOrderAlerts: platformSettings.newOrderAlerts ?? true,
        riderStatusAlerts: platformSettings.riderStatusAlerts ?? true,
        paymentAlerts: platformSettings.paymentAlerts ?? true,
      })
    }
  }, [platformSettings])

  const handlePlatformSave = async () => {
    setSaving(true)
    await dispatch(updatePlatformSettings(platformForm))
    setSaving(false)
  }

  const handleNotificationSave = async () => {
    setSaving(true)
    await dispatch(updatePlatformSettings({ ...platformForm, ...notificationSettings }))
    setSaving(false)
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text mb-6">Settings</h1>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="w-full lg:w-64 bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 shrink-0">
          <nav className="flex lg:flex-col gap-1 lg:gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('platform')}
              className={`flex-1 lg:flex-none lg:w-full text-left px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                activeTab === 'platform'
                  ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-medium'
                  : 'text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
              }`}
            >
              Platform
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`flex-1 lg:flex-none lg:w-full text-left px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                activeTab === 'fees'
                  ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-medium'
                  : 'text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
              }`}
            >
              Fees & Commissions
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 lg:flex-none lg:w-full text-left px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-medium'
                  : 'text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
              }`}
            >
              Notifications
            </button>
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'platform' && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Platform Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Platform Name</label>
                  <input
                    type="text"
                    value={platformForm.platformName}
                    onChange={(e) => setPlatformForm({ ...platformForm, platformName: e.target.value })}
                    className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Default Currency</label>
                  <select
                    value={platformForm.defaultCurrency}
                    onChange={(e) => setPlatformForm({ ...platformForm, defaultCurrency: e.target.value })}
                    className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                  >
                    <option value="NGN">Nigerian Naira (₦)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Timezone</label>
                  <select
                    value={platformForm.timezone}
                    onChange={(e) => setPlatformForm({ ...platformForm, timezone: e.target.value })}
                    className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                  >
                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Support Email</label>
                  <div className="relative">
                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="email"
                      value={platformForm.supportEmail}
                      onChange={(e) => setPlatformForm({ ...platformForm, supportEmail: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Support Phone</label>
                  <div className="relative">
                    <Phone size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="tel"
                      value={platformForm.supportPhone}
                      onChange={(e) => setPlatformForm({ ...platformForm, supportPhone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handlePlatformSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'commissions' && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Commission Defaults</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Default Merchant Commission (%)</label>
                  <div className="relative">
                    <Percent size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="number"
                      value={platformForm.defaultMerchantCommission}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultMerchantCommission: parseFloat(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Default Rider Commission (%)</label>
                  <div className="relative">
                    <Percent size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="number"
                      value={platformForm.defaultRiderCommission}
                      onChange={(e) => setPlatformForm({ ...platformForm, defaultRiderCommission: parseFloat(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Minimum Delivery Fee</label>
                  <div className="relative">
                    <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="number"
                      value={platformForm.minDeliveryFee}
                      onChange={(e) => setPlatformForm({ ...platformForm, minDeliveryFee: parseFloat(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Maximum Delivery Fee</label>
                  <div className="relative">
                    <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="number"
                      value={platformForm.maxDeliveryFee}
                      onChange={(e) => setPlatformForm({ ...platformForm, maxDeliveryFee: parseFloat(e.target.value) })}
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handlePlatformSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Notification Settings</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">Email Notifications</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Receive notifications via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">Push Notifications</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Receive push notifications in browser</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.pushNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, pushNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">SMS Notifications</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Receive notifications via SMS</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.smsNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">New Order Alerts</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Alert when new orders are placed</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.newOrderAlerts}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, newOrderAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">Rider Status Alerts</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Alert when rider status changes</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.riderStatusAlerts}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, riderStatusAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">Payment Alerts</p>
                    <p className="text-sm text-muted dark:text-dark-muted">Alert on payment events</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.paymentAlerts}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, paymentAlerts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-muted after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleNotificationSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
