import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, ArrowRight, ArrowLeft, Check, Store, Package, Clock, Settings, Sparkles } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'

export default function OnboardingWizard() {
  const { merchantId } = useParams()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const [onboardingData, setOnboardingData] = useState({
    skipForLater: false,
    hasAddedProduct: false,
    hasSetHours: false,
    hasConfiguredSettings: false
  })

  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock: ''
  })

  const [hoursData, setHoursData] = useState({
    openingTime: '08:00',
    closingTime: '22:00',
    isOpen: true
  })

  useEffect(() => {
    // Check if merchant has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${merchantId}`)
    if (!hasCompletedOnboarding) {
      setIsVisible(true)
    }
  }, [merchantId])

  const handleSkip = () => {
    setIsVisible(false)
    localStorage.setItem(`onboarding_completed_${merchantId}`, 'true')
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (onboardingData.hasAddedProduct && !validateProduct()) return
    }
    if (currentStep === 2) {
      if (onboardingData.hasSetHours) {
        // Save hours
        saveBusinessHours()
      }
    }
    setCurrentStep(currentStep + 1)
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
      const response = await fetch(`/api/merchants/${merchantId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productData.name,
          description: productData.description,
          price: parseFloat(productData.price),
          category: productData.category || 'General',
          stock: parseInt(productData.stock) || 100,
          isAvailable: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add product')
      }

      showSuccessToast('Product added successfully!')
      setOnboardingData({ ...onboardingData, hasAddedProduct: true })
      setProductData({ name: '', description: '', price: '', category: '', stock: '' })
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
      const response = await fetch(`/api/merchants/${merchantId}`, {
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
    } catch (err) {
      showErrorToast('Failed to save hours. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    setIsVisible(false)
    localStorage.setItem(`onboarding_completed_${merchantId}`, 'true')
    showSuccessToast('Welcome to VTU Logistics! Your dashboard is ready.')
    navigate(`/dashboard/${merchantId}/orders`)
  }

  if (!isVisible) return null

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
                Add your first product
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Set your business hours
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Configure basic settings
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
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                Category
              </label>
              <input
                type="text"
                value={productData.category}
                onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                placeholder="e.g., Rice, Drinks, etc."
                className="w-full px-4 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-dark-surface-muted dark:text-dark-text"
              />
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
      id: 3,
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
          <button
            onClick={saveBusinessHours}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Saving...' : 'Save Hours'}
            <Clock className="w-5 h-5" />
          </button>
        </div>
      )
    },
    {
      id: 4,
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
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            <button
              onClick={handleSkip}
              className="text-muted hover:text-text dark:hover:text-dark-text transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
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
              currentStep === 1 ? 'bg-gradient-to-r from-primary to-primary-700' :
              currentStep === 2 ? 'bg-gradient-to-r from-success to-emerald-600' :
              currentStep === 3 ? 'bg-gradient-to-r from-primary to-primary-700' :
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

          {/* Skip Button */}
          {currentStep < steps.length && (
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
