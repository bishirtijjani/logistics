import { useState, useEffect } from 'react'
import { Shield, Smartphone, Mail, CheckCircle, AlertCircle, Copy, RefreshCw } from 'lucide-react'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'

export default function TwoFactorAuth({ 
  show, 
  method = 'totp', // 'totp' or 'email'
  onVerified, 
  onClose,
  email 
}) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [backupCodes, setBackupCodes] = useState([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [setupMode, setSetupMode] = useState(false)

  useEffect(() => {
    if (show && method === 'totp') {
      setupTOTP()
    }
  }, [show, method])

  const setupTOTP = async () => {
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setQrCode(data.qrCode)
        setSecret(data.secret)
        setBackupCodes(data.backupCodes || [])
        setSetupMode(true)
      }
    } catch (error) {
      console.error('2FA setup error:', error)
    }
  }

  const handleCodeChange = (index, value) => {
    if (value.length > 1) return
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`2fa-code-${index + 1}`)
      if (nextInput) nextInput.focus()
    }

    // Auto-submit if all fields are filled
    if (newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`2fa-code-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  const handleVerify = async (verificationCode) => {
    setLoading(true)
    try {
      const endpoint = setupMode ? '/api/auth/2fa/verify-setup' : '/api/auth/2fa/verify'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          code: verificationCode,
          method,
          secret: setupMode ? secret : undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Invalid verification code')
      }

      showSuccessToast(setupMode ? '2FA enabled successfully!' : '2FA verification successful!')
      onVerified()
    } catch (err) {
      showErrorToast(err.message || 'Failed to verify code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const response = await fetch('/api/auth/2fa/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ method })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to resend code')
      }

      showSuccessToast('Code sent successfully!')
    } catch (err) {
      showErrorToast(err.message || 'Failed to resend code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    showSuccessToast('Copied to clipboard!')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const verificationCode = code.join('')
    if (verificationCode.length !== 6) {
      showErrorToast('Please enter all 6 digits')
      return
    }
    handleVerify(verificationCode)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {setupMode ? 'Setup Two-Factor Authentication' : 'Two-Factor Authentication'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {setupMode 
              ? 'Scan the QR code with your authenticator app'
              : method === 'totp' 
                ? 'Enter the 6-digit code from your authenticator app'
                : `Enter the 6-digit code sent to ${email}`
            }
          </p>
        </div>

        {setupMode && method === 'totp' && (
          <div className="mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Can't scan? Copy this secret:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono break-all">
                  {secret}
                </code>
                <button
                  onClick={() => copyToClipboard(secret)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Enter Verification Code
            </label>
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`2fa-code-${index}`}
                  type="text"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-100"
                  maxLength={1}
                  disabled={loading}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || code.join('').length !== 6}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>
          </div>
        </form>

        {method === 'email' && (
          <div className="mt-6 text-center">
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {resending ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend Code
                </>
              )}
            </button>
          </div>
        )}

        {setupMode && backupCodes.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
            </button>
            
            {showBackupCodes && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Save these backup codes securely
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {backupCodes.map((backupCode, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 p-2 rounded border border-yellow-300 dark:border-yellow-700">
                      {backupCode}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                  Each code can only be used once
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {method === 'totp' 
                ? 'Use apps like Google Authenticator, Authy, or Microsoft Authenticator'
                : 'Check your email for the verification code'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
