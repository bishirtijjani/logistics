import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { X, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { setTransactionPin, resetTransactionPin } from '../store/slices/authSlice'

/**
 * Transaction-PIN modal for VTU purchases. Self-contained across three stages
 * so the merchant never has to leave the page to recover or set a PIN:
 *
 *   enter  - verify an existing PIN, then run onConfirm(pin).
 *   setup  - no PIN yet (server returns PIN_NOT_SET): create + confirm a new
 *            PIN inline, set it, then run onConfirm(pin).
 *   reset  - "Forgot PIN?": re-auth with the account password, set a new PIN,
 *            then run onConfirm(pin).
 *
 * onConfirm(pin) runs the purchase and THROWS on failure (with { status, code }
 * preserved) so this modal can branch on PIN_NOT_SET vs a wrong PIN. The parent
 * owns success handling (toast, refresh, close) and remounts via `key`.
 */
export default function PinModal({ open, title, subtitle, onConfirm, onClose, initialStage = 'enter' }) {
  const dispatch = useDispatch()

  const [stage, setStage] = useState(initialStage) // enter | setup | reset
  const [pin, setPin] = useState('') // primary PIN field (verify / create)
  const [confirmPin, setConfirmPin] = useState('') // second field for setup/reset
  const [password, setPassword] = useState('') // reset stage only
  const [show, setShow] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const firstInputRef = useRef(null)

  // The parent remounts via `key` on each open, so mount === a fresh open.
  useEffect(() => {
    const id = setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [stage])

  if (!open) return null

  const onlyDigits = (v) => v.replace(/[^0-9]/g, '').slice(0, 6)
  const clearError = () => error && setError('')

  // Run the gated action with a known-good PIN. Used after a successful inline
  // set/reset so the merchant doesn't have to re-enter anything.
  const runAction = async (pinValue) => {
    await onConfirm(pinValue)
    setPin('')
    setConfirmPin('')
  }

  const submitEnter = async () => {
    if (pin.length !== 6) return
    setSubmitting(true)
    setError('')
    try {
      await runAction(pin)
    } catch (err) {
      if (err?.code === 'PIN_NOT_SET') {
        // No PIN yet: switch to inline setup instead of a dead end.
        setStage('setup')
        setPin('')
        setConfirmPin('')
        setError('')
      } else {
        setError(err?.message || 'Incorrect PIN. Please try again.')
        setPin('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitSetup = async () => {
    if (pin.length !== 6 || confirmPin.length !== 6) return
    if (pin !== confirmPin) {
      setError("PINs don't match.")
      setConfirmPin('')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await dispatch(setTransactionPin({ pin }))
      if (!setTransactionPin.fulfilled.match(res)) {
        setError(res.payload?.message || "Couldn't set your PIN. Please try again.")
        return
      }
      const newPin = pin
      setStage('enter')
      await runAction(newPin)
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitReset = async () => {
    if (!password.trim()) { setError('Enter your account password.'); return }
    if (pin.length !== 6 || confirmPin.length !== 6) return
    if (pin !== confirmPin) {
      setError("PINs don't match.")
      setConfirmPin('')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await dispatch(resetTransactionPin({ password, pin }))
      if (!resetTransactionPin.fulfilled.match(res)) {
        setError(res.payload?.message || "Couldn't reset your PIN. Check your password and try again.")
        return
      }
      const newPin = pin
      setStage('enter')
      setPassword('')
      await runAction(newPin)
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submit = () => {
    if (submitting) return
    if (stage === 'enter') return submitEnter()
    if (stage === 'setup') return submitSetup()
    return submitReset()
  }

  const headings = {
    enter: { title: title || 'Enter your PIN', subtitle: subtitle || 'Authorize this transaction' },
    setup: { title: 'Set your PIN', subtitle: 'Create a 6-digit transaction PIN, then confirm it.' },
    reset: { title: 'Reset your PIN', subtitle: 'Confirm your account password, then choose a new PIN.' },
  }
  const head = headings[stage]

  const goBackToEnter = () => {
    setStage('enter')
    setPin('')
    setConfirmPin('')
    setPassword('')
    setError('')
  }

  const pinFieldClasses =
    'w-full text-center tracking-[0.6em] text-2xl font-bold px-4 py-3 pr-11 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none text-text dark:text-dark-text disabled:opacity-60'

  const RevealBtn = ({ shown, toggle }) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
      aria-label={shown ? 'Hide' : 'Show'}
    >
      {shown ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  )

  const confirmDisabled =
    submitting ||
    (stage === 'enter' && pin.length !== 6) ||
    (stage === 'setup' && (pin.length !== 6 || confirmPin.length !== 6)) ||
    (stage === 'reset' && (!password.trim() || pin.length !== 6 || confirmPin.length !== 6))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-dark-surface rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {stage !== 'enter' ? (
              <button
                type="button"
                onClick={goBackToEnter}
                disabled={submitting}
                className="w-11 h-11 bg-surface-muted dark:bg-dark-surface-muted rounded-lg flex items-center justify-center text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text disabled:opacity-50"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-11 h-11 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-text dark:text-dark-text">{head.title}</h3>
              {head.subtitle ? <p className="text-xs text-muted dark:text-dark-muted mt-0.5">{head.subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reset: account password */}
        {stage === 'reset' && (
          <div className="relative mb-3">
            <input
              ref={firstInputRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              disabled={submitting}
              onChange={(e) => { setPassword(e.target.value); clearError() }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="Account password"
              className="w-full px-4 py-3 pr-11 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none text-text dark:text-dark-text disabled:opacity-60"
            />
            <RevealBtn shown={showPassword} toggle={() => setShowPassword((s) => !s)} />
          </div>
        )}

        {/* Primary PIN field (verify / create / new) */}
        <div className="relative">
          <input
            ref={stage === 'reset' ? undefined : firstInputRef}
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            disabled={submitting}
            onChange={(e) => { setPin(onlyDigits(e.target.value)); clearError() }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="······"
            className={pinFieldClasses}
            aria-label={stage === 'enter' ? 'PIN' : 'New PIN'}
          />
          <RevealBtn shown={show} toggle={() => setShow((s) => !s)} />
        </div>

        {/* Confirm field for setup / reset */}
        {stage !== 'enter' && (
          <div className="relative mt-3">
            <input
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={confirmPin}
              disabled={submitting}
              onChange={(e) => { setConfirmPin(onlyDigits(e.target.value)); clearError() }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder="Confirm PIN"
              className={pinFieldClasses}
              aria-label="Confirm PIN"
            />
          </div>
        )}

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={confirmDisabled}
          className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing…' : stage === 'enter' ? 'Confirm' : stage === 'setup' ? 'Set PIN' : 'Reset PIN'}
        </button>

        {/* Forgot link only on the verify stage */}
        {stage === 'enter' && (
          <button
            type="button"
            onClick={() => { setStage('reset'); setPin(''); setConfirmPin(''); setError('') }}
            disabled={submitting}
            className="mt-3 w-full text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            Forgot PIN?
          </button>
        )}
      </div>
    </div>
  )
}
