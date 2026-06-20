import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { User, Mail, Phone, Lock, Bell, Globe, Save, Percent, DollarSign } from 'lucide-react'
import { fetchPlatformSettings, updatePlatformSettings } from '../store/slices/settingsSlice'
import NumberInput from '../components/NumberInput.jsx'

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
    withdrawalFee: 20,
    withdrawalFeePayer: 'PLATFORM',
    fundingFeePercent: 1,
    fundingFeePayer: 'PLATFORM',
    vtuProviderMode: 'BILALSADASUB_ONLY',
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
        withdrawalFee: platformSettings.wallet?.withdrawalFee || platformSettings.withdrawalFee || 20,
        withdrawalFeePayer: platformSettings.withdrawalFeePayer || 'PLATFORM',
        fundingFeePercent: platformSettings.fundingFeePercent || 1,
        fundingFeePayer: platformSettings.fundingFeePayer || 'PLATFORM',
        vtuProviderMode: platformSettings.vtuProviderMode || 'BILALSADASUB_ONLY',
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

  // The fee/commission fields are entered as formatted strings ("5,000" →
  // "5000"); coerce them back to numbers before they hit the API.
  const normalizedPlatformForm = () => ({
    ...platformForm,
    defaultMerchantCommission: Number(platformForm.defaultMerchantCommission) || 0,
    defaultRiderCommission: Number(platformForm.defaultRiderCommission) || 0,
    minDeliveryFee: Number(platformForm.minDeliveryFee) || 0,
    maxDeliveryFee: Number(platformForm.maxDeliveryFee) || 0,
    withdrawalFee: Number(platformForm.withdrawalFee) || 0,
    fundingFeePercent: Number(platformForm.fundingFeePercent) || 0,
  })

  const handlePlatformSave = async () => {
    setSaving(true)
    await dispatch(updatePlatformSettings(normalizedPlatformForm()))
    setSaving(false)
  }

  const handleNotificationSave = async () => {
    setSaving(true)
    await dispatch(updatePlatformSettings({ ...normalizedPlatformForm(), ...notificationSettings }))
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
              onClick={() => setActiveTab('vtu')}
              className={`flex-1 lg:flex-none lg:w-full text-left px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                activeTab === 'vtu'
                  ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-medium'
                  : 'text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
              }`}
            >
              VTU Providers
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
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
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
                      className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
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

          {activeTab === 'fees' && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Fees & Commissions</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Minimum Delivery Fee</label>
                    <div className="relative">
                      <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <NumberInput
                        decimal
                        value={platformForm.minDeliveryFee}
                        onChange={(val) => setPlatformForm({ ...platformForm, minDeliveryFee: val })}
                        className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Maximum Delivery Fee</label>
                    <div className="relative">
                      <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <NumberInput
                        decimal
                        value={platformForm.maxDeliveryFee}
                        onChange={(val) => setPlatformForm({ ...platformForm, maxDeliveryFee: val })}
                        className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-surface-muted dark:border-dark-surface-muted" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Withdrawal Fee (Flat NGN)</label>
                    <div className="relative">
                      <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <NumberInput
                        decimal
                        value={platformForm.withdrawalFee}
                        onChange={(val) => setPlatformForm({ ...platformForm, withdrawalFee: val })}
                        className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Withdrawal Fee Payer</label>
                    <select
                      value={platformForm.withdrawalFeePayer}
                      onChange={(e) => setPlatformForm({ ...platformForm, withdrawalFeePayer: e.target.value })}
                      className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                    >
                      <option value="PLATFORM">Platform pays (Waived for user)</option>
                      <option value="USER">User pays (Deducted from balance)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Wallet Funding Fee (%)</label>
                    <div className="relative">
                      <Percent size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="number"
                        value={platformForm.fundingFeePercent}
                        onChange={(e) => setPlatformForm({ ...platformForm, fundingFeePercent: parseFloat(e.target.value) })}
                        className="w-full pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Funding Fee Payer</label>
                    <select
                      value={platformForm.fundingFeePayer}
                      onChange={(e) => setPlatformForm({ ...platformForm, fundingFeePayer: e.target.value })}
                      className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                    >
                      <option value="PLATFORM">Platform pays (Waived for user)</option>
                      <option value="USER">User pays (Deducted from credit)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
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

          {activeTab === 'vtu' && (
            <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-1">VTU Providers</h2>
              <p className="text-sm text-muted dark:text-dark-muted mb-6">
                Choose which upstream VTU provider(s) vend airtime, data, cable and electricity. Per-network and per-plan provider IDs are managed on the VTU Networks and VTU Plans pages.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Provider Routing</label>
                  <select
                    value={platformForm.vtuProviderMode}
                    onChange={(e) => setPlatformForm({ ...platformForm, vtuProviderMode: e.target.value })}
                    className="w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text"
                  >
                    <option value="BILALSADASUB_ONLY">BilalSada only</option>
                    <option value="ALRAHUZ_ONLY">AlRahuz only</option>
                    <option value="BOTH">Both — BilalSada primary, AlRahuz failover</option>
                  </select>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1">
                    In “Both” mode a purchase that BilalSada fails is retried on AlRahuz before any refund — so a failed transaction doesn’t lose the sale. A purchase only fails over when that network/plan has its AlRahuz IDs set.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
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
