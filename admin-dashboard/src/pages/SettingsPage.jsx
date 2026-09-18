import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { Mail, Phone, Save, Percent, DollarSign, AlertTriangle, MapPin, Clock, Wallet, Zap } from 'lucide-react'
import { fetchPlatformSettings, updatePlatformSettings } from '../store/slices/settingsSlice'
import NumberInput from '../components/NumberInput.jsx'
import Toggle from '../components/Toggle.jsx'

const TABS = [
  { id: 'platform', label: 'Platform' },
  { id: 'fees', label: 'Fees & Commissions' },
  { id: 'delivery-ops', label: 'Delivery Operations' },
  { id: 'limits', label: 'Limits & Minimums' },
  { id: 'vtu', label: 'VTU Providers' },
  { id: 'payments', label: 'Payments' },
  { id: 'notifications', label: 'Notifications' },
]

const DEFAULT_FORM = {
  platformName: 'iPrime',
  defaultCurrency: 'NGN',
  timezone: 'Africa/Lagos',
  supportEmail: 'support@iprime.ng',
  supportPhone: '+2348000000000',

  withdrawalFee: 20,
  withdrawalFeePayer: 'PLATFORM',
  fundingFeePercent: 1,
  fundingFeePayer: 'PLATFORM',
  vtuProviderMode: 'BILALSADASUB_ONLY',
  paymentsProviderMode: 'KATPAY',

  deliveryBaseFare: 200,
  deliveryPerKmRate: 100,
  deliveryPlatformFeePercent: 10,
  deliveryCancellationFee: 0,
  itemPlatformFeePercent: 15,

  deliveryMatchingEnabled: true,
  deliveryBroadcastRadiusRingsText: '5, 10, 15',
  deliveryBroadcastRingTimeoutSec: 60,
  deliveryUnmatchedReRingSec: 120,
  deliveryAutoCancelUnmatchedMinutes: 60,

  deliveryRequirePodPhoto: true,
  deliveryRequireSignature: false,
  deliveryPodOtpThresholdNgn: 50000,

  walletMinTopup: 100,
  walletMinWithdraw: 500,
  walletMaxWithdraw: 500000,
  walletMinTransfer: 50,

  utilityMinAirtimeAmount: 50,
  utilityMinElectricityAmount: 500,
  utilityElectricityServiceFeePercent: 1,
}

// Field className helpers, kept short since almost every input on this page shares them.
const inputClass =
  'w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text'
const moneyInputClass = `pl-10 pr-4 py-2 ${inputClass.replace('px-4 py-2 ', '')}`
const labelClass = 'block text-sm font-medium text-text dark:text-dark-text mb-1'
const helpClass = 'text-xs text-muted dark:text-dark-muted mb-2'
const cardClass = 'bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6'
const sectionTitleClass = 'text-base font-semibold text-text dark:text-dark-text mb-1'

function Field({ label, help, children }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {help && <p className={helpClass}>{help}</p>}
      {children}
    </div>
  )
}

function MoneyField({ label, help, value, onChange }) {
  return (
    <Field label={label} help={help}>
      <div className="relative">
        <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <NumberInput decimal value={value} onChange={onChange} className={moneyInputClass} />
      </div>
    </Field>
  )
}

function PercentField({ label, help, value, onChange }) {
  return (
    <Field label={label} help={help}>
      <div className="relative">
        <Percent size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <NumberInput decimal value={value} onChange={onChange} className={moneyInputClass} />
      </div>
    </Field>
  )
}

function SaveButton({ saving, onClick }) {
  return (
    <div className="mt-8 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
      >
        <Save size={18} />
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const dispatch = useDispatch()
  const { platformSettings } = useSelector((state) => state.settings)
  const [activeTab, setActiveTab] = useState('platform')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
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
    if (!platformSettings) return
    setForm({
      platformName: platformSettings.platformName || DEFAULT_FORM.platformName,
      defaultCurrency: platformSettings.defaultCurrency || DEFAULT_FORM.defaultCurrency,
      timezone: platformSettings.timezone || DEFAULT_FORM.timezone,
      supportEmail: platformSettings.supportEmail || DEFAULT_FORM.supportEmail,
      supportPhone: platformSettings.supportPhone || DEFAULT_FORM.supportPhone,

      withdrawalFee: platformSettings.withdrawalFee ?? DEFAULT_FORM.withdrawalFee,
      withdrawalFeePayer: platformSettings.withdrawalFeePayer || DEFAULT_FORM.withdrawalFeePayer,
      fundingFeePercent: platformSettings.fundingFeePercent ?? DEFAULT_FORM.fundingFeePercent,
      fundingFeePayer: platformSettings.fundingFeePayer || DEFAULT_FORM.fundingFeePayer,
      vtuProviderMode: platformSettings.vtuProviderMode || DEFAULT_FORM.vtuProviderMode,
      paymentsProviderMode: platformSettings.paymentsProviderMode || DEFAULT_FORM.paymentsProviderMode,

      deliveryBaseFare: platformSettings.deliveryBaseFare ?? DEFAULT_FORM.deliveryBaseFare,
      deliveryPerKmRate: platformSettings.deliveryPerKmRate ?? DEFAULT_FORM.deliveryPerKmRate,
      deliveryPlatformFeePercent: platformSettings.deliveryPlatformFeePercent ?? DEFAULT_FORM.deliveryPlatformFeePercent,
      deliveryCancellationFee: platformSettings.deliveryCancellationFee ?? DEFAULT_FORM.deliveryCancellationFee,
      itemPlatformFeePercent: platformSettings.itemPlatformFeePercent ?? DEFAULT_FORM.itemPlatformFeePercent,

      deliveryMatchingEnabled: platformSettings.deliveryMatchingEnabled ?? DEFAULT_FORM.deliveryMatchingEnabled,
      deliveryBroadcastRadiusRingsText: Array.isArray(platformSettings.deliveryBroadcastRadiusRings)
        ? platformSettings.deliveryBroadcastRadiusRings.join(', ')
        : DEFAULT_FORM.deliveryBroadcastRadiusRingsText,
      deliveryBroadcastRingTimeoutSec: platformSettings.deliveryBroadcastRingTimeoutSec ?? DEFAULT_FORM.deliveryBroadcastRingTimeoutSec,
      deliveryUnmatchedReRingSec: platformSettings.deliveryUnmatchedReRingSec ?? DEFAULT_FORM.deliveryUnmatchedReRingSec,
      deliveryAutoCancelUnmatchedMinutes: platformSettings.deliveryAutoCancelUnmatchedMinutes ?? DEFAULT_FORM.deliveryAutoCancelUnmatchedMinutes,

      deliveryRequirePodPhoto: platformSettings.deliveryRequirePodPhoto ?? DEFAULT_FORM.deliveryRequirePodPhoto,
      deliveryRequireSignature: platformSettings.deliveryRequireSignature ?? DEFAULT_FORM.deliveryRequireSignature,
      deliveryPodOtpThresholdNgn: platformSettings.deliveryPodOtpThresholdNgn ?? DEFAULT_FORM.deliveryPodOtpThresholdNgn,

      walletMinTopup: platformSettings.walletMinTopup ?? DEFAULT_FORM.walletMinTopup,
      walletMinWithdraw: platformSettings.walletMinWithdraw ?? DEFAULT_FORM.walletMinWithdraw,
      walletMaxWithdraw: platformSettings.walletMaxWithdraw ?? DEFAULT_FORM.walletMaxWithdraw,
      walletMinTransfer: platformSettings.walletMinTransfer ?? DEFAULT_FORM.walletMinTransfer,

      utilityMinAirtimeAmount: platformSettings.utilityMinAirtimeAmount ?? DEFAULT_FORM.utilityMinAirtimeAmount,
      utilityMinElectricityAmount: platformSettings.utilityMinElectricityAmount ?? DEFAULT_FORM.utilityMinElectricityAmount,
      utilityElectricityServiceFeePercent: platformSettings.utilityElectricityServiceFeePercent ?? DEFAULT_FORM.utilityElectricityServiceFeePercent,
    })
    setNotificationSettings({
      emailNotifications: platformSettings.emailNotifications ?? true,
      pushNotifications: platformSettings.pushNotifications ?? true,
      smsNotifications: platformSettings.smsNotifications ?? false,
      newOrderAlerts: platformSettings.newOrderAlerts ?? true,
      riderStatusAlerts: platformSettings.riderStatusAlerts ?? true,
      paymentAlerts: platformSettings.paymentAlerts ?? true,
    })
  }, [platformSettings])

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setChecked = (key) => (checked) => setForm((f) => ({ ...f, [key]: checked }))

  // Money/percent fields come back from NumberInput as formatted strings; the
  // rings field is a free-typed "5, 10, 15" string. Coerce everything to the
  // real numeric shapes the API expects right before it goes out the door.
  const buildPayload = () => {
    const rings = form.deliveryBroadcastRadiusRingsText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)

    return {
      supportEmail: form.supportEmail,
      supportPhone: form.supportPhone,

      withdrawalFee: Number(form.withdrawalFee) || 0,
      withdrawalFeePayer: form.withdrawalFeePayer,
      fundingFeePercent: Number(form.fundingFeePercent) || 0,
      fundingFeePayer: form.fundingFeePayer,
      vtuProviderMode: form.vtuProviderMode,
      paymentsProviderMode: form.paymentsProviderMode,

      deliveryBaseFare: Number(form.deliveryBaseFare) || 0,
      deliveryPerKmRate: Number(form.deliveryPerKmRate) || 0,
      deliveryPlatformFeePercent: Number(form.deliveryPlatformFeePercent) || 0,
      deliveryCancellationFee: Number(form.deliveryCancellationFee) || 0,
      itemPlatformFeePercent: Number(form.itemPlatformFeePercent) || 0,

      deliveryMatchingEnabled: form.deliveryMatchingEnabled,
      deliveryBroadcastRadiusRings: rings.length > 0 ? rings : [5, 10, 15],
      deliveryBroadcastRingTimeoutSec: Number(form.deliveryBroadcastRingTimeoutSec) || 60,
      deliveryUnmatchedReRingSec: Number(form.deliveryUnmatchedReRingSec) || 120,
      deliveryAutoCancelUnmatchedMinutes: Number(form.deliveryAutoCancelUnmatchedMinutes) || 60,

      deliveryRequirePodPhoto: form.deliveryRequirePodPhoto,
      deliveryRequireSignature: form.deliveryRequireSignature,
      deliveryPodOtpThresholdNgn: Number(form.deliveryPodOtpThresholdNgn) || 0,

      walletMinTopup: Number(form.walletMinTopup) || 0,
      walletMinWithdraw: Number(form.walletMinWithdraw) || 0,
      walletMaxWithdraw: Number(form.walletMaxWithdraw) || 0,
      walletMinTransfer: Number(form.walletMinTransfer) || 0,

      utilityMinAirtimeAmount: Number(form.utilityMinAirtimeAmount) || 0,
      utilityMinElectricityAmount: Number(form.utilityMinElectricityAmount) || 0,
      utilityElectricityServiceFeePercent: Number(form.utilityElectricityServiceFeePercent) || 0,
    }
  }

  const save = async (extra = {}) => {
    setSaving(true)
    const result = await dispatch(updatePlatformSettings({ ...buildPayload(), ...extra }))
    setSaving(false)
    if (result.error) {
      toast.error(result.error.message || 'Could not save settings. Please try again.')
    } else {
      toast.success('Settings saved. Changes apply immediately - no restart needed.')
    }
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text mb-6">Settings</h1>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="w-full lg:w-64 bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto -mx-1 px-1 lg:mx-0 lg:px-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 lg:flex-none lg:w-full text-left px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-medium'
                    : 'text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'platform' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Platform Configuration</h2>

              <div className="space-y-4">
                <Field label="Platform Name">
                  <input type="text" value={form.platformName} onChange={(e) => set('platformName')(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Default Currency">
                  <select value={form.defaultCurrency} onChange={(e) => set('defaultCurrency')(e.target.value)} className={inputClass}>
                    <option value="NGN">Nigerian Naira (₦)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </Field>
                <Field label="Timezone">
                  <select value={form.timezone} onChange={(e) => set('timezone')(e.target.value)} className={inputClass}>
                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </Field>
                <Field label="Support Email" help="Shown to customers, riders and merchants in the app when they need help.">
                  <div className="relative">
                    <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="email" value={form.supportEmail} onChange={(e) => set('supportEmail')(e.target.value)} className={moneyInputClass} />
                  </div>
                </Field>
                <Field label="Support Phone" help="Shown to customers, riders and merchants in the app when they need help.">
                  <div className="relative">
                    <Phone size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="tel" value={form.supportPhone} onChange={(e) => set('supportPhone')(e.target.value)} className={moneyInputClass} />
                  </div>
                </Field>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'fees' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Fees & Commissions</h2>

              <div className="space-y-8">
                <div>
                  <h3 className={sectionTitleClass}>Delivery Pricing</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">What customers are charged for a delivery, and how much of it your platform keeps.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MoneyField
                      label="Base Delivery Fee"
                      help="The starting price for every delivery, before distance is added."
                      value={form.deliveryBaseFare}
                      onChange={set('deliveryBaseFare')}
                    />
                    <MoneyField
                      label="Price per Kilometre"
                      help="Added on top of the base fee for every kilometre the rider travels."
                      value={form.deliveryPerKmRate}
                      onChange={set('deliveryPerKmRate')}
                    />
                    <PercentField
                      label="Platform's Share of Delivery Fee"
                      help="How much of each delivery fee your platform keeps. The rest goes to the rider."
                      value={form.deliveryPlatformFeePercent}
                      onChange={set('deliveryPlatformFeePercent')}
                    />
                    <MoneyField
                      label="Cancellation Fee"
                      help="Charged to the customer if they cancel a delivery after a rider has already been assigned."
                      value={form.deliveryCancellationFee}
                      onChange={set('deliveryCancellationFee')}
                    />
                  </div>
                </div>

                <hr className="border-surface-muted dark:border-dark-surface-muted" />

                <div>
                  <h3 className={sectionTitleClass}>Merchant Orders</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">What your platform keeps when a customer buys items from a merchant (separate from the delivery fee).</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PercentField
                      label="Platform's Share of Item Orders"
                      help="How much of the items total your platform keeps. The rest goes to the merchant."
                      value={form.itemPlatformFeePercent}
                      onChange={set('itemPlatformFeePercent')}
                    />
                  </div>
                </div>

                <hr className="border-surface-muted dark:border-dark-surface-muted" />

                <div>
                  <h3 className={sectionTitleClass}>Wallet Fees</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">Fees charged when users move money in and out of their wallet.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MoneyField
                      label="Withdrawal Fee (Flat)"
                      help="A fixed charge every time a user withdraws money from their wallet."
                      value={form.withdrawalFee}
                      onChange={set('withdrawalFee')}
                    />
                    <Field label="Who Pays the Withdrawal Fee?">
                      <select value={form.withdrawalFeePayer} onChange={(e) => set('withdrawalFeePayer')(e.target.value)} className={inputClass}>
                        <option value="PLATFORM">Platform pays (waived for the user)</option>
                        <option value="USER">User pays (deducted from their balance)</option>
                      </select>
                    </Field>
                    <PercentField
                      label="Wallet Funding Fee"
                      help="A percentage charged when a user adds money to their wallet."
                      value={form.fundingFeePercent}
                      onChange={set('fundingFeePercent')}
                    />
                    <Field label="Who Pays the Funding Fee?">
                      <select value={form.fundingFeePayer} onChange={(e) => set('fundingFeePayer')(e.target.value)} className={inputClass}>
                        <option value="PLATFORM">Platform pays (waived for the user)</option>
                        <option value="USER">User pays (deducted from the amount credited)</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'delivery-ops' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Delivery Operations</h2>

              <div className="space-y-8">
                <div>
                  <h3 className={`${sectionTitleClass} flex items-center gap-2`}><MapPin size={18} /> Rider Matching</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">Controls how a new delivery order finds a rider to carry it.</p>

                  <div className="space-y-4">
                    <Toggle
                      label="Automatic Rider Matching"
                      description="When this is switched off, NEW orders will not be sent to any rider - deliveries stop platform-wide until you turn it back on. Use this only to pause the whole delivery service."
                      checked={form.deliveryMatchingEnabled}
                      onChange={setChecked('deliveryMatchingEnabled')}
                      danger
                    />
                    {!form.deliveryMatchingEnabled && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>Rider matching is currently OFF. Customers can still place orders, but no rider will be offered any of them until you switch this back on.</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <Field
                      label="Rider Search Distance (km)"
                      help={'How far to search for a rider, in steps, closest first. E.g. "5, 10, 15" searches 5km first, then widens to 10km, then 15km if no one has accepted yet.'}
                    >
                      <div className="relative">
                        <MapPin size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          value={form.deliveryBroadcastRadiusRingsText}
                          onChange={(e) => set('deliveryBroadcastRadiusRingsText')(e.target.value)}
                          placeholder="5, 10, 15"
                          className={moneyInputClass}
                        />
                      </div>
                    </Field>
                    <Field label="Time Per Search Step (seconds)" help="How long to wait for a rider to accept before widening the search to the next step.">
                      <div className="relative">
                        <Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <NumberInput value={form.deliveryBroadcastRingTimeoutSec} onChange={set('deliveryBroadcastRingTimeoutSec')} className={moneyInputClass} />
                      </div>
                    </Field>
                    <Field label="Retry Interval While Waiting (seconds)" help="Once every search step has been tried and no rider is found, how often to keep offering the order to nearby riders.">
                      <div className="relative">
                        <Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <NumberInput value={form.deliveryUnmatchedReRingSec} onChange={set('deliveryUnmatchedReRingSec')} className={moneyInputClass} />
                      </div>
                    </Field>
                    <Field label="Auto-Cancel After No Rider Found (minutes)" help="If still no rider has accepted after this long, the order is automatically cancelled and the customer refunded.">
                      <div className="relative">
                        <Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <NumberInput value={form.deliveryAutoCancelUnmatchedMinutes} onChange={set('deliveryAutoCancelUnmatchedMinutes')} className={moneyInputClass} />
                      </div>
                    </Field>
                  </div>
                </div>

                <hr className="border-surface-muted dark:border-dark-surface-muted" />

                <div>
                  <h3 className={sectionTitleClass}>Proof of Delivery</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">What a rider must provide before an order can be marked as delivered.</p>

                  <div className="space-y-4">
                    <Toggle
                      label="Require Photo Proof"
                      description="The rider must take a photo of the delivered package before the order can be marked complete."
                      checked={form.deliveryRequirePodPhoto}
                      onChange={setChecked('deliveryRequirePodPhoto')}
                    />
                    <Toggle
                      label="Require Signature Proof"
                      description="The customer must sign on the rider's phone before the order can be marked complete."
                      checked={form.deliveryRequireSignature}
                      onChange={setChecked('deliveryRequireSignature')}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <MoneyField
                      label="Require a Delivery Code Above"
                      help="For orders worth more than this amount, the rider must also enter a one-time code told to them by the customer before completing delivery. Set to 0 to always require it."
                      value={form.deliveryPodOtpThresholdNgn}
                      onChange={set('deliveryPodOtpThresholdNgn')}
                    />
                  </div>
                </div>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'limits' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Limits & Minimums</h2>

              <div className="space-y-8">
                <div>
                  <h3 className={`${sectionTitleClass} flex items-center gap-2`}><Wallet size={18} /> Wallet</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">The smallest and largest amounts users are allowed to move in and out of their wallet.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MoneyField
                      label="Minimum Top-up"
                      help="The smallest amount a user can add to their wallet in one go."
                      value={form.walletMinTopup}
                      onChange={set('walletMinTopup')}
                    />
                    <MoneyField
                      label="Minimum Withdrawal"
                      help="The smallest amount a user can withdraw from their wallet in one go."
                      value={form.walletMinWithdraw}
                      onChange={set('walletMinWithdraw')}
                    />
                    <MoneyField
                      label="Maximum Withdrawal"
                      help="The largest amount a user can withdraw from their wallet in one go."
                      value={form.walletMaxWithdraw}
                      onChange={set('walletMaxWithdraw')}
                    />
                    <MoneyField
                      label="Minimum Money Transfer"
                      help="The smallest amount a user can send to another user's wallet."
                      value={form.walletMinTransfer}
                      onChange={set('walletMinTransfer')}
                    />
                  </div>
                </div>

                <hr className="border-surface-muted dark:border-dark-surface-muted" />

                <div>
                  <h3 className={`${sectionTitleClass} flex items-center gap-2`}><Zap size={18} /> Utility Payments</h3>
                  <p className="text-sm text-muted dark:text-dark-muted mb-4">The smallest amount a user can pay for airtime or electricity.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MoneyField
                      label="Minimum Airtime Purchase"
                      value={form.utilityMinAirtimeAmount}
                      onChange={set('utilityMinAirtimeAmount')}
                    />
                    <MoneyField
                      label="Minimum Electricity Payment"
                      value={form.utilityMinElectricityAmount}
                      onChange={set('utilityMinElectricityAmount')}
                    />
                    <PercentField
                      label="Electricity Service Charge"
                      help="Charged on top of the face value for every electricity purchase (e.g. ₦10 on ₦1,000, ₦100 on ₦10,000). Data/cable/airtime already carry their own margin; electricity has none built in, since the amount vended IS the token value."
                      value={form.utilityElectricityServiceFeePercent}
                      onChange={set('utilityElectricityServiceFeePercent')}
                    />
                  </div>
                </div>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'vtu' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-1">VTU Providers</h2>
              <p className="text-sm text-muted dark:text-dark-muted mb-6">
                Choose which upstream VTU provider(s) vend airtime, data, cable and electricity. Per-network and per-plan provider IDs are managed on the VTU Networks and VTU Plans pages.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Provider Routing">
                  <select value={form.vtuProviderMode} onChange={(e) => set('vtuProviderMode')(e.target.value)} className={inputClass}>
                    <option value="BILALSADASUB_ONLY">BilalSada only</option>
                    <option value="ALRAHUZ_ONLY">AlRahuz only</option>
                    <option value="BOTH">Both — BilalSada primary, AlRahuz failover</option>
                  </select>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1">
                    In "Both" mode a purchase that BilalSada fails is retried on AlRahuz before any refund — so a failed transaction doesn't lose the sale. A purchase only fails over when that network/plan has its AlRahuz IDs set.
                  </p>
                </Field>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-1">Payment Gateway</h2>
              <p className="text-sm text-muted dark:text-dark-muted mb-6">
                Choose the provider that handles new wallet funding (funding NUBAN + card checkout) and payouts. Existing virtual accounts keep working in either mode.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Active Gateway">
                  <select value={form.paymentsProviderMode} onChange={(e) => set('paymentsProviderMode')(e.target.value)} className={inputClass}>
                    <option value="KATPAY">KatPay</option>
                    <option value="PAYSTACK">Paystack</option>
                  </select>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1">
                    Switching takes effect on the next funding top-up, signup provisioning, or withdrawal. Both providers' webhooks stay registered so transactions started under the other gateway still settle.
                  </p>
                </Field>
              </div>

              <SaveButton saving={saving} onClick={() => save()} />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-text dark:text-dark-text mb-6">Notification Settings</h2>

              <div className="space-y-4">
                <Toggle
                  label="Email Notifications"
                  description="Receive notifications via email"
                  checked={notificationSettings.emailNotifications}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, emailNotifications: v })}
                />
                <Toggle
                  label="Push Notifications"
                  description="Receive push notifications in browser"
                  checked={notificationSettings.pushNotifications}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, pushNotifications: v })}
                />
                <Toggle
                  label="SMS Notifications"
                  description="Receive notifications via SMS"
                  checked={notificationSettings.smsNotifications}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, smsNotifications: v })}
                />
                <Toggle
                  label="New Order Alerts"
                  description="Alert when new orders are placed"
                  checked={notificationSettings.newOrderAlerts}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, newOrderAlerts: v })}
                />
                <Toggle
                  label="Rider Status Alerts"
                  description="Alert when rider status changes"
                  checked={notificationSettings.riderStatusAlerts}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, riderStatusAlerts: v })}
                />
                <Toggle
                  label="Payment Alerts"
                  description="Alert on payment events"
                  checked={notificationSettings.paymentAlerts}
                  onChange={(v) => setNotificationSettings({ ...notificationSettings, paymentAlerts: v })}
                />
              </div>

              <SaveButton saving={saving} onClick={() => save(notificationSettings)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
