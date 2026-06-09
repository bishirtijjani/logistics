import { useEffect, useRef, useState } from 'react'
import { X, Lock, Eye, EyeOff } from 'lucide-react'

/**
 * Transaction-PIN entry modal for VTU purchases. Mirrors the mobile
 * PinBottomSheet contract: onConfirm(pin) runs the purchase and THROWS on
 * failure with { status, code, errors } so this modal can render:
 *   - PIN_NOT_SET (code) → prompt to set a PIN (shouldn't normally fire; the
 *                          page gates on transactionPinSetByUser first)
 *   - any other failure  → "Incorrect PIN" / the server message, retry freely
 *
 * There is intentionally NO attempt-counting or lockout (removed by product
 * decision). The parent owns success handling (toast, refresh, close).
 */
export default function PinModal({ open, title, subtitle, onConfirm, onClose }) {
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  // The parent remounts this modal (via `key`) each time it opens, so mount ===
  // a fresh open with clean initial state. We only need to autofocus the field.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  if (!open) return null

  const submit = async () => {
    if (submitting || pin.length !== 6) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(pin)
      // Success - parent closes the modal. Clear local state defensively.
      setPin('')
    } catch (err) {
      const code = err?.code
      if (code === 'PIN_NOT_SET') {
        setError('You have not set a transaction PIN yet. Set one in Settings → Security.')
      } else {
        setError(err?.message || 'Incorrect PIN. Please try again.')
      }
      setPin('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-dark-surface rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text dark:text-dark-text">{title || 'Enter your PIN'}</h3>
              {subtitle ? <p className="text-xs text-muted dark:text-dark-muted mt-0.5">{subtitle}</p> : null}
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

        <div className="relative">
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            disabled={submitting}
            onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, '')); if (error) setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="······"
            className="w-full text-center tracking-[0.6em] text-2xl font-bold px-4 py-3 pr-11 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none text-text dark:text-dark-text disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
            aria-label={show ? 'Hide PIN' : 'Show PIN'}
          >
            {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || pin.length !== 6}
          className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
