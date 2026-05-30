import React, { useState } from 'react'
import { API_URL } from '../lib/api'
import { useDispatch, useSelector } from 'react-redux'
import { X, ArrowRight, ArrowLeft, Check, Store, Package, Clock, Settings, Sparkles, MapPin } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'
import { updateSettings } from '../store/slices/settingsSlice.js'
import LocationPicker from './LocationPicker.jsx'

/**
 * Onboarding flow. Visibility and the "needs onboarding" signal both come
 * from the parent (Layout) — which derives them from the merchant profile in
 * Redux (lat/lng/address). No more localStorage flag, so a merchant who
 * skips can be re-engaged via the dashboard banner.
 *
 * props:
 *   open      — whether the modal is currently visible
 *   onClose   — called when the wizard is dismissed for any reason
 */
export default function OnboardingWizard({ open, onClose }) {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  // The merchant's fixed business category (chosen at signup) — products are
  // tagged with it silently; the merchant never picks a category here.
  const merchantCategorySlug = useSelector((state) => state.settings.settings?.category?.slug)
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [onboardingData, setOnboardingData] = useState({
    skipForLater: false,
    hasAddedProduct: false,
    hasConfiguredSettings: false
  })

  // Location is collected here (not at registration) so merchants pin a real
  // map location instead of starting at a hardcoded city centre. The PATCH
  // is gated by `locationSaved` and the step cannot be skipped.
  const [locationData, setLocationData] = useState({ address: '', lat: 0, lng: 0 })
  const [locationSaved, setLocationSaved] = useState(false)

  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    stock: ''
  })

  const [hoursData, setHoursData] = useState({
    openingTime: '08:00',
    closingTime: '22:00',
    isOpen: true
  })

  const handleSkip = () => {
    onClose?.()
  }

  const handleNext = async () => {
    // Step 2 (location) is required — block advance until the pin is saved.
    if (currentStep === 2 && !locationSaved) {
      const ok = await saveLocation()
      if (!ok) return
    }
    if (currentStep === 3) {
      if (onboardingData.hasAddedProduct && !validateProduct()) return
    }
    if (currentStep === 4) {
      // The Next button is the only save affordance for hours now — the
      // inline "Save Hours" button was removed because it never updated the
      // wizard's own state, so users hit Next thinking they were done and
      // nothing actually persisted.
      const ok = await saveBusinessHours()
      if (!ok) return
    }
    setCurrentStep(currentStep + 1)
  }

  const saveLocation = async () => {
    if (!locationData.lat || !locationData.lng) {
      showErrorToast('Drop a pin on the map to set your location')
      return false
    }
    if (!merchantId) {
      showErrorToast('Missing merchant context — try logging out and back in')
      return false
    }
    setLoading(true)
    try {
      // Dispatch via Redux so the parent Layout's `needsOnboarding` selector
      // flips immediately and the dashboard banner self-dismisses without a
      // refetch.
      await dispatch(
        updateSettings({
          merchantId,
          address: locationData.address,
          lat: locationData.lat,
          lng: locationData.lng,
        }),
      ).unwrap()
      setLocationSaved(true)
      showSuccessToast('Location saved!')
      return true
    } catch (err) {
      showErrorToast(err?.message || 'Failed to save location. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const validateProduct = () => {
    if (!productData.name || !productData.price) {
      showErrorToast('Please enter product name and price')
      return false
    }
    return true
  }

  const handleAddProduct = async () => {
    if (!validateProduct()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/merchants/${merchantId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          // Bound to the merchant's business category, not a free-text guess.
          category: merchantCategorySlug || 'General',
          stock: parseInt(productData.stock) || 100,
          isAvailable: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add product')
      }

      showSuccessToast('Product added successfully!')
      setOnboardingData({ ...onboardingData, hasAddedProduct: true })
      setProductData({ name: '', description: '', price: '', stock: '' })
    } catch (err) {
      showErrorToast('Failed to add product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveBusinessHours = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/merchants/${merchantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          openingTime: hoursData.openingTime,
          closingTime: hoursData.closingTime,
          isOpen: hoursData.isOpen
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save hours')
      }

      showSuccessToast('Business hours saved!')
      return true
    } catch (err) {
      showErrorToast('Failed to save hours. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    showSuccessToast('Welcome to iPrime! Your dashboard is ready.')
    onClose?.()
  }

  if (!open) return null

  const steps = [
    {
      id: 1,
      icon: Sparkles,
      title: 'Welcome Aboard!',
      description: 'Let\'s get your business set up and ready to start receiving orders.',
      component: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 rounded-xl p-6">
            <h4 className="font-semibold text-text dark:text-dark-text mb-2">What you'll accomplish:</h4>
            <ul className="space-y-2 text-sm text-muted dark:text-dark-muted">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Pin your business location
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Add your first product
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Set your business hours
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Start receiving orders
              </li>
            </ul>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted dark:text-dark-muted">
              This will take about 5 minutes
            </p>
          </div>
        </div>
      )
    },
    {
      id: 2,
      icon: MapPin,
      title: 'Pin Your Business Location',
      description: 'Drop a pin so customers can find you and we can calculate accurate delivery fees.',
      component: (
        <div className="space-y-4">
          <LocationPicker
            value={locationData}
            onChange={(next) => {
              setLocationData(next)
              setLocationSaved(false)
            }}
          />
          {locationSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
              <Check className="w-4 h-4 flex-shrink-0" />
              Location saved. Click Next to continue.
            </div>
          )}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400">
            This step is required — your business won't be approved or visible to customers until your location is pinned.
          </div>
        </div>
      )
    },
    {
      id: 3,
      icon: Package,
      title: 'Add Your First Product',
      description: 'Start by adding your first product to your catalog.',
      component: (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={productData.name}
                onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                placeholder="e.g., Jollof Rice"
                className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                Description
              </label>
              <textarea
                value={productData.description}
                onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                placeholder="Describe your product"
                rows={3}
                className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Price (₦) *
                </label>
                <input
                  type="number"
                  value={productData.price}
                  onChange={(e) => setProductData({ ...productData, price: e.target.value })}
                  placeholder="1500"
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Stock
                </label>
                <input
                  type="number"
                  value={productData.stock}
                  onChange={(e) => setProductData({ ...productData, stock: e.target.value })}
                  placeholder="50"
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleAddProduct}
            disabled={loading || onboardingData.hasAddedProduct}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Adding...' : onboardingData.hasAddedProduct ? '✓ Product Added' : 'Add Product'}
            <Package className="w-5 h-5" />
          </button>
        </div>
      )
    },
    {
      id: 4,
      icon: Clock,
      title: 'Set Business Hours',
      description: 'Configure when your business is open for orders.',
      component: (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${hoursData.isOpen ? 'bg-success' : 'bg-error'}`} />
                <span className="font-medium text-text dark:text-dark-text">
                  {hoursData.isOpen ? 'Open for Business' : 'Closed'}
                </span>
              </div>
              <button
                onClick={() => setHoursData({ ...hoursData, isOpen: !hoursData.isOpen })}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hoursData.isOpen
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {hoursData.isOpen ? 'Open' : 'Closed'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={hoursData.openingTime}
                  onChange={(e) => setHoursData({ ...hoursData, openingTime: e.target.value })}
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={hoursData.closingTime}
                  onChange={(e) => setHoursData({ ...hoursData, closingTime: e.target.value })}
                  className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
                />
              </div>
            </div>
            <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-xl p-4">
              <p className="text-sm text-primary dark:text-primary-300">
                💡 Customers can only place orders during your business hours
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 5,
      icon: Settings,
      title: 'You\'re All Set!',
      description: 'Your business is ready to start receiving orders.',
      component: (
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-xl font-bold text-text dark:text-dark-text">
              Setup Complete!
            </h4>
            <p className="text-muted dark:text-dark-muted">
              Your business is now configured and ready to receive orders.
            </p>
          </div>
          <div className="bg-gradient-to-r from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 rounded-xl p-6 space-y-3">
            <h5 className="font-semibold text-text dark:text-dark-text">Next Steps:</h5>
            <ul className="space-y-2 text-sm text-muted dark:text-dark-muted">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Add more products to your catalog
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Monitor incoming orders in real-time
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Track your earnings and analytics
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Manage your settings anytime
              </li>
            </ul>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface dark:bg-dark-surface border-b border-surface-muted dark:border-dark-surface-muted p-6 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-primary to-primary-700 rounded-xl">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text dark:text-dark-text">
                  Setup Your Business
                </h2>
                <p className="text-sm text-muted dark:text-dark-muted">
                  Step {currentStep} of {steps.length}
                </p>
              </div>
            </div>
            {currentStep !== 2 && (
              <button
                onClick={handleSkip}
                className="text-muted hover:text-text dark:hover:text-dark-text transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-surface-muted dark:bg-dark-surface-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary-700 transition-all duration-300"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-xl ${
              currentStep === 2 ? 'bg-gradient-to-r from-success to-emerald-600' :
              'bg-gradient-to-r from-primary to-primary-700'
            }`}>
              {React.createElement(steps[currentStep - 1].icon, { className: 'w-6 h-6 text-white' })}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                {steps[currentStep - 1].title}
              </h3>
              <p className="text-sm text-muted dark:text-dark-muted">
                {steps[currentStep - 1].description}
              </p>
            </div>
          </div>

          <div className="mb-6">
            {steps[currentStep - 1].component}
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
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

            {currentStep < steps.length ? (
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
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-success to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Complete Setup
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Skip Button — hidden on the required Location step (step 2) */}
          {currentStep < steps.length && currentStep !== 2 && (
            <button
              onClick={handleSkip}
              className="w-full mt-4 py-3 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text transition-colors text-sm"
            >
              Skip for now, I'll do this later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
