import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  Phone, Wifi, Tv, Zap, Receipt, Check, AlertCircle, ShieldAlert, Wallet,
} from 'lucide-react'
import {
  fetchPlans, buyAirtime, buyData, buyCable, payElectricity,
  validateIuc, validateMeter, clearValidation,
  fetchUtilityHistory, fetchUtilityPayment,
} from '../store/slices/utilitySlice'
import { fetchWallet } from '../store/slices/walletSlice'
import { fetchAuthProfile } from '../store/slices/authSlice'
import { showSuccessToast, showErrorToast } from '../utils/toast'
import PinModal from '../components/PinModal'

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`

const inputCls =
  'w-full px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none text-text dark:text-dark-text'
const labelCls = 'block text-sm font-medium text-text dark:text-dark-text mb-1'
const cardCls = 'bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6'
const payBtnCls =
  'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const CABLE_PROVIDERS = [
  { id: 1, name: 'GOTV', color: '#00A650' },
  { id: 2, name: 'DSTV', color: '#0066CC' },
  { id: 3, name: 'STARTIME', color: '#E8003D' },
]
const NETWORK_COLORS = { MTN: '#FFCC00', GLO: '#00AA00', '9MOBILE': '#0066CC', AIRTEL: '#FF0000', SMILE: '#1E90FF' }
const AIRTIME_QUICK = [100, 200, 500, 1000, 2000, 5000]
const ELEC_QUICK = [1000, 2000, 5000, 10000, 20000]
const MIN_AIRTIME = 100 // Provider floor; buys below this hang in PROCESSING.
const MIN_ELEC = 500

const TABS = [
  { key: 'airtime', label: 'Airtime', icon: Phone },
  { key: 'data', label: 'Data', icon: Wifi },
  { key: 'cable', label: 'Cable TV', icon: Tv },
  { key: 'electricity', label: 'Electricity', icon: Zap },
  { key: 'history', label: 'History', icon: Receipt },
]

// Small reusable chip button for network/provider/disco selection.
function Chip({ active, onClick, children, dotColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-text dark:text-dark-text hover:border-primary/50'
      }`}
    >
      {dotColor ? <span className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} /> : null}
      {children}
    </button>
  )
}

export default function BillsPage() {
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)
  const hasPin = user?.transactionPinSetByUser === true
  const wallet = useSelector((s) => s.wallet)
  const balance = Number(wallet?.balance ?? 0)

  const [activeTab, setActiveTab] = useState('airtime')
  const [pinState, setPinState] = useState({ open: false, title: '', subtitle: '', onConfirm: null })
  const [pinKey, setPinKey] = useState(0) // bumped on each open so PinModal remounts fresh

  // Boot: spending balance (earnings wallet), live PIN flag, and the two
  // catalogues every tab needs up front (airtime networks + electricity discos).
  useEffect(() => {
    dispatch(fetchWallet())
    dispatch(fetchAuthProfile())
    dispatch(fetchPlans({ type: 'AIRTIME' }))
    dispatch(fetchPlans({ type: 'ELECTRICITY' }))
  }, [dispatch])

  // Gateway every purchase passes through. Blocks until the merchant replaces
  // the seeded default PIN, then opens the keypad. `action(pin)` performs the
  // dispatch+unwrap (throwing on failure so PinModal can render the reason).
  const requestPin = (action, { title, subtitle }) => {
    if (!hasPin) {
      showErrorToast('Set your transaction PIN in Settings → Security before paying bills.')
      return
    }
    setPinKey((k) => k + 1) // remount the modal so it opens with clean state
    setPinState({
      open: true,
      title,
      subtitle,
      onConfirm: async (pin) => {
        await action(pin) // throws on failure → handled inside PinModal
        setPinState((s) => ({ ...s, open: false }))
        // Refresh spending balance + jump to History so the merchant sees it.
        dispatch(fetchWallet())
        dispatch(fetchUtilityHistory({ page: 1, limit: 20 }))
        setActiveTab('history')
      },
    })
  }

  const closePin = () => setPinState((s) => ({ ...s, open: false }))

  const shared = { balance, naira, requestPin, dispatch }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">Pay Bills</h1>
          <p className="text-muted dark:text-dark-muted">
            Buy airtime, data, cable TV and electricity straight from your earnings.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-dark-surface shadow-sm px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted dark:text-dark-muted">Available to spend</p>
            <p className="text-lg font-bold text-text dark:text-dark-text leading-none">{naira(balance)}</p>
          </div>
        </div>
      </div>

      {!hasPin && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-4">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Set your transaction PIN first</p>
            <p className="text-amber-700 dark:text-amber-400/90">
              Your account still uses the starter PIN. Set a new 6-digit PIN in{' '}
              <Link to="/dashboard/settings" className="font-semibold underline">Settings → Security</Link>{' '}
              before you can pay bills.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-surface-muted dark:border-dark-surface-muted">
        <nav className="flex gap-4 sm:gap-8 overflow-x-auto -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-4 border-b-2 font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === 'airtime' && <AirtimeTab {...shared} />}
      {activeTab === 'data' && <DataTab {...shared} />}
      {activeTab === 'cable' && <CableTab {...shared} />}
      {activeTab === 'electricity' && <ElectricityTab {...shared} />}
      {activeTab === 'history' && <HistoryTab naira={naira} dispatch={dispatch} />}

      <PinModal
        key={pinKey}
        open={pinState.open}
        title={pinState.title}
        subtitle={pinState.subtitle}
        onConfirm={pinState.onConfirm || (async () => {})}
        onClose={closePin}
      />
    </div>
  )
}

// ── Airtime ────────────────────────────────────────────────────────────────
function AirtimeTab({ balance, naira, requestPin, dispatch }) {
  const networks = useSelector((s) => s.utility.plans.AIRTIME || [])
  const [networkId, setNetworkId] = useState(null)
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')

  // Derive the active network (default to the first) rather than setting it in
  // an effect - avoids a cascading re-render and keeps user selection sticky.
  const network = networks.find((n) => n.id === networkId) || networks[0] || null

  const pay = () => {
    if (!network) return showErrorToast('Select a network')
    if (!phone || phone.length < 10) return showErrorToast('Enter a valid phone number')
    const amt = Number(amount)
    if (!amt || amt < MIN_AIRTIME) return showErrorToast(`Minimum airtime is ${naira(MIN_AIRTIME)}`)
    if (amt > balance) return showErrorToast('Insufficient balance')
    requestPin(
      async (pin) => {
        await dispatch(buyAirtime({ networkId: network.providerNetworkId, phone: phone.trim(), amount: amt, pin })).unwrap()
        showSuccessToast(`${naira(amt)} airtime queued for ${phone}`)
        setAmount('')
      },
      { title: 'Confirm airtime purchase', subtitle: `${naira(amt)} • ${network.networkName} • ${phone}` },
    )
  }

  return (
    <div className={cardCls}>
      <div className="space-y-5 max-w-xl">
        <div>
          <label className={labelCls}>Network</label>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <Chip key={n.id} active={network?.id === n.id} onClick={() => setNetworkId(n.id)} dotColor={NETWORK_COLORS[n.networkName] || '#999'}>
                {n.networkName}
              </Chip>
            ))}
            {!networks.length && <p className="text-sm text-muted dark:text-dark-muted">Loading networks…</p>}
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone number</label>
          <input className={inputCls} inputMode="numeric" maxLength={11} placeholder="080XXXXXXXX"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input className={inputCls} inputMode="numeric" placeholder="Enter amount"
            value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="text-xs text-muted dark:text-dark-muted mt-1">Minimum {naira(MIN_AIRTIME)}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {AIRTIME_QUICK.map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                  Number(amount) === v ? 'border-primary bg-primary text-white' : 'border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:border-primary/50'
                }`}>
                {naira(v)}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={pay} className={payBtnCls}>
          {amount ? `Pay ${naira(amount)}` : 'Buy airtime'}
        </button>
      </div>
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────────
function DataTab({ balance, naira, requestPin, dispatch }) {
  const networks = useSelector((s) => s.utility.plans.AIRTIME || [])
  const plans = useSelector((s) => s.utility.plans)
  const isLoading = useSelector((s) => s.utility.isLoading)
  const [networkId, setNetworkId] = useState(null)
  const [phone, setPhone] = useState('')
  const [planId, setPlanId] = useState(null)

  const network = networks.find((n) => n.id === networkId) || networks[0] || null
  const dataPlans = network ? (plans[`DATA-${network.providerNetworkId}`] || []) : []
  // Deriving the plan from planId means it auto-clears when the network (and so
  // the plan list) changes - no reset effect needed.
  const plan = dataPlans.find((p) => p.id === planId) || null

  // Effect only synchronizes the external store (fetch plans); no setState here.
  useEffect(() => {
    if (network) dispatch(fetchPlans({ type: 'DATA', networkId: network.providerNetworkId }))
  }, [network?.providerNetworkId, dispatch])

  const pay = () => {
    if (!phone || phone.length < 10) return showErrorToast('Enter a valid phone number')
    if (!plan) return showErrorToast('Select a data plan')
    if (Number(plan.sellingPrice) > balance) return showErrorToast('Insufficient balance')
    requestPin(
      async (pin) => {
        await dispatch(buyData({ planId: plan.id, phone: phone.trim(), pin })).unwrap()
        showSuccessToast(`${plan.name} queued for ${phone}`)
      },
      { title: 'Confirm data purchase', subtitle: `${plan.name} • ${naira(plan.sellingPrice)} • ${phone}` },
    )
  }

  return (
    <div className={cardCls}>
      <div className="space-y-5 max-w-xl">
        <div>
          <label className={labelCls}>Network</label>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <Chip key={n.id} active={network?.id === n.id} onClick={() => setNetworkId(n.id)} dotColor={NETWORK_COLORS[n.networkName] || '#999'}>
                {n.networkName}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone number</label>
          <input className={inputCls} inputMode="numeric" maxLength={11} placeholder="080XXXXXXXX"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
        <div>
          <label className={labelCls}>Plan</label>
          {isLoading && !dataPlans.length ? (
            <p className="text-sm text-muted dark:text-dark-muted">Loading plans…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dataPlans.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    plan?.id === p.id ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-surface-muted dark:border-dark-surface-muted hover:border-primary/50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text dark:text-dark-text">{p.name}</span>
                    <span className="font-bold text-primary">{naira(p.sellingPrice)}</span>
                  </div>
                  <p className="text-xs text-muted dark:text-dark-muted mt-1">
                    {p.planType ? `${p.planType} • ` : ''}Validity: {p.validity || 'N/A'}
                  </p>
                </button>
              ))}
              {!dataPlans.length && <p className="text-sm text-muted dark:text-dark-muted">No plans for this network.</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={pay} disabled={!plan} className={payBtnCls}>
          {plan ? `Pay ${naira(plan.sellingPrice)}` : 'Select a plan'}
        </button>
      </div>
    </div>
  )
}

// ── Cable ─────────────────────────────────────────────────────────────────────
function CableTab({ balance, naira, requestPin, dispatch }) {
  const plans = useSelector((s) => s.utility.plans)
  const isLoading = useSelector((s) => s.utility.isLoading)
  const isValidating = useSelector((s) => s.utility.isValidating)
  const validationResult = useSelector((s) => s.utility.validationResult)
  const [provider, setProvider] = useState(CABLE_PROVIDERS[0])
  const [smartCard, setSmartCard] = useState('')
  const [validated, setValidated] = useState(false)
  const [planId, setPlanId] = useState(null)

  // Effect only fetches the catalogue; the per-provider resets happen in the
  // selectProvider handler (an event, not an effect) to avoid setState-in-effect.
  useEffect(() => {
    dispatch(fetchPlans({ type: 'CABLE', networkId: provider.id }))
  }, [provider.id, dispatch])

  const cablePlans = plans[`CABLE-${provider.id}`] || []
  const plan = cablePlans.find((p) => p.id === planId) || null
  const customerName = validationResult?.Customer_Name || validationResult?.name || 'Verified'

  const selectProvider = (p) => {
    setProvider(p)
    setValidated(false)
    setPlanId(null)
    dispatch(clearValidation())
  }

  const verify = async () => {
    if (!smartCard.trim()) return showErrorToast('Enter the smart card number')
    try {
      await dispatch(validateIuc({ smartCardNumber: smartCard.trim(), cableNameId: provider.id })).unwrap()
      setValidated(true)
    } catch {
      setValidated(false)
      showErrorToast('Could not verify that smart card')
    }
  }

  const pay = () => {
    if (!validated) return showErrorToast('Verify the smart card first')
    if (!plan) return showErrorToast('Select a package')
    if (Number(plan.sellingPrice) > balance) return showErrorToast('Insufficient balance')
    requestPin(
      async (pin) => {
        await dispatch(buyCable({ planId: plan.id, smartCardNumber: smartCard.trim(), pin })).unwrap()
        showSuccessToast(`${plan.name} queued for ${smartCard}`)
      },
      { title: 'Confirm cable subscription', subtitle: `${plan.name} • ${naira(plan.sellingPrice)} • ${customerName}` },
    )
  }

  return (
    <div className={cardCls}>
      <div className="space-y-5 max-w-xl">
        <div>
          <label className={labelCls}>Provider</label>
          <div className="flex flex-wrap gap-2">
            {CABLE_PROVIDERS.map((p) => (
              <Chip key={p.id} active={provider.id === p.id} onClick={() => selectProvider(p)} dotColor={p.color}>
                {p.name}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Smart card number</label>
          <div className="flex gap-2">
            <input className={inputCls} inputMode="numeric" placeholder="Smart card / IUC number"
              value={smartCard}
              onChange={(e) => { setSmartCard(e.target.value.replace(/[^0-9]/g, '')); setValidated(false); dispatch(clearValidation()) }} />
            <button type="button" onClick={verify} disabled={isValidating}
              className="shrink-0 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-700 disabled:opacity-50">
              {isValidating ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          {validationResult && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <Check className="w-4 h-4" /> {customerName}
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Package</label>
          {isLoading && !cablePlans.length ? (
            <p className="text-sm text-muted dark:text-dark-muted">Loading packages…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cablePlans.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    plan?.id === p.id ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-surface-muted dark:border-dark-surface-muted hover:border-primary/50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text dark:text-dark-text">{p.name}</span>
                    <span className="font-bold text-primary">{naira(p.sellingPrice)}</span>
                  </div>
                  {p.validity ? <p className="text-xs text-muted dark:text-dark-muted mt-1">{p.validity}</p> : null}
                </button>
              ))}
              {!cablePlans.length && <p className="text-sm text-muted dark:text-dark-muted">No packages available.</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={pay} disabled={!plan} className={payBtnCls}>
          {plan ? `Pay ${naira(plan.sellingPrice)}` : 'Select a package'}
        </button>
      </div>
    </div>
  )
}

// ── Electricity ────────────────────────────────────────────────────────────────
function ElectricityTab({ balance, naira, requestPin, dispatch }) {
  const discos = useSelector((s) => s.utility.plans.ELECTRICITY || [])
  const isValidating = useSelector((s) => s.utility.isValidating)
  const validationResult = useSelector((s) => s.utility.validationResult)
  const [discoId, setDiscoId] = useState(null)
  const [meterType, setMeterType] = useState('PREPAID')
  const [meter, setMeter] = useState('')
  const [validated, setValidated] = useState(false)
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')

  const disco = discos.find((d) => d.id === discoId) || discos[0] || null
  const customerName = validationResult?.Customer_Name || validationResult?.name || 'Verified'

  const verify = async () => {
    if (!meter.trim() || meter.length < 11) return showErrorToast('Enter a valid meter number')
    if (!disco) return showErrorToast('Select a provider')
    try {
      await dispatch(validateMeter({ meterNumber: meter.trim(), discoId: disco.providerNetworkId, meterType })).unwrap()
      setValidated(true)
    } catch {
      setValidated(false)
      showErrorToast('Could not verify that meter')
    }
  }

  const pay = () => {
    if (!disco) return showErrorToast('Select a provider')
    if (!validated) return showErrorToast('Verify the meter first')
    if (!phone || phone.length < 10) return showErrorToast('Enter a valid phone number')
    const amt = Number(amount)
    if (!amt || amt < MIN_ELEC) return showErrorToast(`Minimum is ${naira(MIN_ELEC)}`)
    if (amt > balance) return showErrorToast('Insufficient balance')
    requestPin(
      async (pin) => {
        await dispatch(payElectricity({
          discoId: disco.providerNetworkId, meterNumber: meter.trim(), meterType, amount: amt, phone: phone.trim(), pin,
        })).unwrap()
        showSuccessToast('Electricity payment processing - your token will appear in History.')
        setAmount('')
      },
      { title: 'Confirm electricity payment', subtitle: `${naira(amt)} • ${disco.networkName} • ${meter}` },
    )
  }

  return (
    <div className={cardCls}>
      <div className="space-y-5 max-w-xl">
        <div>
          <label className={labelCls}>Provider</label>
          <div className="flex flex-wrap gap-2">
            {discos.map((d) => (
              <Chip key={d.id} active={disco?.id === d.id} onClick={() => { setDiscoId(d.id); setValidated(false); dispatch(clearValidation()) }}>
                {d.networkName}
              </Chip>
            ))}
            {!discos.length && <p className="text-sm text-muted dark:text-dark-muted">Loading providers…</p>}
          </div>
        </div>
        <div>
          <label className={labelCls}>Meter type</label>
          <div className="flex gap-2">
            {['PREPAID', 'POSTPAID'].map((mt) => (
              <Chip key={mt} active={meterType === mt} onClick={() => { setMeterType(mt); setValidated(false); dispatch(clearValidation()) }}>
                {mt === 'PREPAID' ? 'Prepaid' : 'Postpaid'}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Meter number</label>
          <div className="flex gap-2">
            <input className={inputCls} inputMode="numeric" placeholder="Meter number"
              value={meter}
              onChange={(e) => { setMeter(e.target.value.replace(/[^0-9]/g, '')); setValidated(false); dispatch(clearValidation()) }} />
            <button type="button" onClick={verify} disabled={isValidating}
              className="shrink-0 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-700 disabled:opacity-50">
              {isValidating ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          {validationResult && (
            <div className="mt-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2"><Check className="w-4 h-4" /> {customerName}</div>
              {validationResult.Address ? <p className="text-xs mt-1 ml-6">{validationResult.Address}</p> : null}
            </div>
          )}
        </div>
        <div>
          <label className={labelCls}>Phone number</label>
          <input className={inputCls} inputMode="numeric" maxLength={11} placeholder="080XXXXXXXX"
            value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input className={inputCls} inputMode="numeric" placeholder="Enter amount"
            value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          <div className="flex flex-wrap gap-2 mt-2">
            {ELEC_QUICK.map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                  Number(amount) === v ? 'border-primary bg-primary text-white' : 'border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:border-primary/50'
                }`}>
                {naira(v)}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={pay} className={payBtnCls}>
          {amount ? `Pay ${naira(amount)}` : 'Buy electricity'}
        </button>
      </div>
    </div>
  )
}

// ── History ────────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}
const TYPE_ICON = { AIRTIME: Phone, DATA: Wifi, CABLE: Tv, ELECTRICITY: Zap }
const PENDING_STATUSES = ['PENDING', 'PROCESSING']

function HistoryTab({ naira, dispatch }) {
  const history = useSelector((s) => s.utility.history)
  const isLoading = useSelector((s) => s.utility.isLoading)
  const pollRef = useRef(null)

  useEffect(() => { dispatch(fetchUtilityHistory({ page: 1, limit: 20 })) }, [dispatch])

  // Poll pending rows so PROCESSING → COMPLETED (and the electricity token)
  // surface without a manual refresh.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const pendingIds = history.filter((r) => PENDING_STATUSES.includes(r.status)).map((r) => r.id)
    if (!pendingIds.length) return undefined
    pollRef.current = setInterval(() => {
      pendingIds.forEach((id) => dispatch(fetchUtilityPayment(id)))
    }, 5000)
    return () => pollRef.current && clearInterval(pollRef.current)
  }, [history, dispatch])

  const rows = useMemo(() => history || [], [history])

  return (
    <div className={cardCls}>
      {isLoading && !rows.length ? (
        <p className="text-sm text-muted dark:text-dark-muted">Loading…</p>
      ) : !rows.length ? (
        <div className="text-center py-10 text-muted dark:text-dark-muted">
          <Receipt className="w-8 h-8 mx-auto mb-2 opacity-60" />
          No bill payments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const Icon = TYPE_ICON[r.type] || Receipt
            const recipient = r.phoneNumber || r.meterNumber || '-'
            return (
              <div key={r.id} className="flex items-center gap-3 p-4 rounded-lg bg-surface-muted dark:bg-dark-surface-muted">
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-dark-surface flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text dark:text-dark-text">{r.biller || r.type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted dark:text-dark-muted truncate">
                    {recipient}{r.plan ? ` • ${r.plan}` : ''} • {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.token ? (
                    <p className="text-xs font-bold text-primary mt-1">Token: {r.token}</p>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-text dark:text-dark-text">{naira(r.amount)}</p>
                  {r.status === 'FAILED' || r.status === 'REFUNDED' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3 h-3" /> refunded
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
