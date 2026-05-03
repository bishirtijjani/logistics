import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Store, User, MapPin, Clock, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'

export default function RegistrationPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')

  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  const [businessInfo, setBusinessInfo] = useState({
    businessName: '',
    businessType: 'RESTAURANT',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    openingTime: '08:00',
    closingTime: '22:00',
    lat: 13.0059,
    lng: 7.6017
  })

  const businessTypes = [
    { value: 'RESTAURANT', label: 'Restaurant', icon: '🍔', description: 'Food delivery' },
    { value: 'GROCERY', label: 'Grocery Store', icon: '🛒', description: 'Grocery delivery' },
    { value: 'PHARMACY', label: 'Pharmacy', icon: '💊', description: 'Medicine delivery' }
  ]

  const validatePersonalInfo = () => {
    if (!personalInfo.firstName || !personalInfo.lastName) {
      setError('Please enter your first and last name')
      return false
    }
    if (!personalInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
      setError('Please enter a valid email address')
      return false
    }
    if (!personalInfo.phone || !/^0[789][01]\d{8}$/.test(personalInfo.phone)) {
      setError('Please enter a valid Nigerian phone number')
      return false
    }
    if (!personalInfo.password || personalInfo.password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }
    if (personalInfo.password !== personalInfo.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    setError('')
    return true
  }

  const validateBusinessInfo = () => {
    if (!businessInfo.businessName) {
      setError('Please enter your business name')
      return false
    }
    if (!businessInfo.businessPhone) {
      setError('Please enter your business phone number')
      return false
    }
    if (!businessInfo.businessEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessInfo.businessEmail)) {
      setError('Please enter a valid business email')
      return false
    }
    if (!businessInfo.businessAddress) {
      setError('Please enter your business address')
      return false
    }
    setError('')
    return true
  }

  const handleNext = () => {
    if (currentStep === 1 && !validatePersonalInfo()) return
    if (currentStep === 2 && !validateBusinessInfo()) return
    setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/merchant/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...personalInfo,
          ...businessInfo
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      if (data.success) {
        setVerificationSent(true)
        if (data.data && data.data.devOtp) {
          showSuccessToast(`Registration successful! Your verification code is: ${data.data.devOtp}`)
        } else {
          showSuccessToast('Registration successful! Please check your email for verification code.')
        }
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
      showErrorToast(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: personalInfo.email,
          code: otp
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed')
      }

      if (data.success) {
        showSuccessToast('Email verified successfully! Your account is now pending admin approval.')
        navigate('/login')
      }
    } catch (err) {
      setError(err.message || 'Verification failed')
      showErrorToast(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-muted via-surface-muted to-surface-muted dark:from-dark-surface-muted dark:via-dark-surface-muted dark:to-dark-surface-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-surface dark:bg-dark-surface rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text dark:text-dark-text mb-2">
                Verify Your Email
              </h2>
              <p className="text-muted dark:text-dark-muted">
                Enter the 6-digit code sent to {personalInfo.email}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  maxLength={6}
                />
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setVerificationSent(false)}
                className="w-full py-3 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors"
              >
                Back to Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-muted to-surface dark:from-dark-background dark:via-dark-surface-muted dark:to-dark-surface flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary-700 rounded-2xl mb-4 shadow-lg">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-text dark:text-dark-text mb-2">
            Join VTU Logistics
          </h1>
          <p className="text-muted dark:text-dark-muted">
            Start delivering your products to customers in Katsina
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                currentStep === step
                  ? 'bg-gradient-to-r from-primary to-primary-700 text-white'
                  : currentStep > step
                  ? 'bg-success text-white'
                  : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'
              }`}>
                {currentStep > step ? <Check className="w-5 h-5" /> : step}
              </div>
              {step < 3 && (
                <div className={`w-24 h-1 mx-2 rounded ${
                  currentStep > step ? 'bg-success' : 'bg-surface-muted dark:bg-dark-surface-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Main Form Card */}
        <div className="bg-surface dark:bg-dark-surface rounded-3xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-error/10 dark:bg-error/20 border border-error/20 dark:border-error/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Personal Information
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Tell us about yourself
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={personalInfo.firstName}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={personalInfo.lastName}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  placeholder="08012345678"
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={personalInfo.password}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, password: e.target.value })}
                    placeholder="Min. 8 characters"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={personalInfo.confirmPassword}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Business Information
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Tell us about your business
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-3">
                  Business Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {businessTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setBusinessInfo({ ...businessInfo, businessType: type.value })}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        businessInfo.businessType === type.value
                          ? 'border-primary bg-primary/10 dark:bg-primary/20'
                          : 'border-surface-muted dark:border-dark-surface-muted hover:border-primary/50 dark:hover:border-primary/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{type.icon}</div>
                      <div className="font-semibold text-text dark:text-dark-text">{type.label}</div>
                      <div className="text-sm text-muted dark:text-dark-muted">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessInfo.businessName}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, businessName: e.target.value })}
                  placeholder="My Restaurant"
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={businessInfo.businessPhone}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, businessPhone: e.target.value })}
                    placeholder="08098765432"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={businessInfo.businessEmail}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, businessEmail: e.target.value })}
                    placeholder="business@example.com"
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Business Address
                </label>
                <textarea
                  value={businessInfo.businessAddress}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, businessAddress: e.target.value })}
                  placeholder="123 Main Street, Katsina"
                  rows={3}
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text resize-none"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                    Operating Hours
                  </h3>
                  <p className="text-sm text-muted dark:text-dark-muted">
                    Set your business hours
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={businessInfo.openingTime}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, openingTime: e.target.value })}
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={businessInfo.closingTime}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, closingTime: e.target.value })}
                    className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-text dark:text-dark-text mb-1">
                      Location Information
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Your business location will be set to Katsina, Nigeria. You can update this later in your settings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-text dark:text-dark-text mb-1">
                      Approval Required
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Your account will be reviewed by our team before activation. This typically takes 1-2 business days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-xl p-6">
                <h4 className="font-semibold text-text dark:text-dark-text mb-4">
                  Summary
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Name:</span>
                    <span className="font-medium text-text dark:text-dark-text">
                      {personalInfo.firstName} {personalInfo.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Email:</span>
                    <span className="font-medium text-text dark:text-dark-text">{personalInfo.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Business:</span>
                    <span className="font-medium text-text dark:text-dark-text">{businessInfo.businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-dark-muted">Type:</span>
                    <span className="font-medium text-text dark:text-dark-text">{businessInfo.businessType}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={loading}
                className="flex-1 py-3 border-2 border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-xl font-semibold hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-success to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-muted dark:text-dark-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
