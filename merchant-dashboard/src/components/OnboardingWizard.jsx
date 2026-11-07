import React, { useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import { useDispatch, useSelector } from 'react-redux'
import { X, ArrowRight, ArrowLeft, Check, Store, Package, Plus, Sparkles, MapPin, ImagePlus } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'
import { updateSettings } from '../store/slices/settingsSlice.js'
import { createProduct } from '../store/slices/productsSlice.js'
import LocationPicker from './LocationPicker.jsx'
import CloudinaryImageUploader from './CloudinaryImageUploader.jsx'
import { ProductCreateModal } from '../pages/MenuPage.jsx'

/**
 * Onboarding flow. Visibility and the "needs onboarding" signal both come
 * from the parent (Layout) - which derives them from the merchant profile in
 * Redux (lat/lng/address). No more localStorage flag, so a merchant who
 * skips can be re-engaged via the dashboard banner.
 *
 * props:
 *   open      - whether the modal is currently visible
 *   onClose   - called when the wizard is dismissed for any reason
 */
export default function OnboardingWizard({ open, onClose }) {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  // Full merchant profile (lat/lng/address) - drives the "already pinned"
  // logic so a merchant reopening the wizard just to add their first product
  // isn't forced to re-pin a location they already have.
  const merchantProfile = useSelector((state) => state.settings.settings)
  // Existing products (populated by Layout's fetchProducts). A merchant who
  // already has products only needs to add a cover here, so the product step is
  // treated as done and isn't forced again.
  const { products, total: productTotal } = useSelector((state) => state.products)
  const alreadyHasProducts = (productTotal || 0) > 0 || (products?.length || 0) > 0
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // The merchant's locked-in business category - needed by the real product
  // modal (ProductCreateModal) to render its category-aware form. Fetched the
  // same way the Products page does.
  const [merchantCategory, setMerchantCategory] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)

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

  // Store photo step: cover is required, logo is optional. `photoSaved` tracks
  // whether the current cover has been persisted to the merchant profile (the
  // uploader returns a Cloudinary URL immediately, but it isn't on the profile
  // until the PATCH lands - which is what flips Layout's onboarding signal).
  const [photoData, setPhotoData] = useState({ logoUrl: '', coverImageUrl: '' })
  const [photoSaved, setPhotoSaved] = useState(false)
  const photoAlreadySet = !!merchantProfile?.coverImageUrl
  // The product step is complete if one was added in this session OR the
  // merchant already had products before opening the wizard.
  const productDone = onboardingData.hasAddedProduct || alreadyHasProducts

  // Placeholder coords are 0,0 and a "Pending…" address - either means the
  // merchant hasn't pinned a real location yet (mirrors Layout's check).
  const locationAlreadySet =
    !!merchantProfile &&
    !(Number(merchantProfile.lat) === 0 && Number(merchantProfile.lng) === 0) &&
    !(typeof merchantProfile.address === 'string' && merchantProfile.address.startsWith('Pending'))

  // Lazily fetch the business category the first time the wizard opens - most
  // sessions never open it.
  useEffect(() => {
    if (!open || !merchantId || merchantCategory) return
    api
      .get(`/merchants/${merchantId}`)
      .then((r) => setMerchantCategory(r.data?.data?.category || null))
      .catch(() => {})
  }, [open, merchantId, merchantCategory])

  // Prefill an already-saved location once so step 2 doesn't demand a re-pin
  // when the merchant reopened the wizard only to add their first product.
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (prefilledRef.current || !locationAlreadySet || !merchantProfile) return
    prefilledRef.current = true
    setLocationData({
      address: merchantProfile.address || '',
      lat: Number(merchantProfile.lat) || 0,
      lng: Number(merchantProfile.lng) || 0,
    })
    setLocationSaved(true)
  }, [locationAlreadySet, merchantProfile])

  // Prefill any already-saved store imagery once so a returning merchant sees
  // their existing cover/logo instead of an empty uploader.
  const photoPrefilledRef = useRef(false)
  useEffect(() => {
    if (photoPrefilledRef.current || !merchantProfile) return
    photoPrefilledRef.current = true
    setPhotoData({
      logoUrl: merchantProfile.logoUrl || '',
      coverImageUrl: merchantProfile.coverImageUrl || '',
    })
    setPhotoSaved(!!merchantProfile.coverImageUrl)
  }, [merchantProfile])

  // Choose the starting step once per open: jump straight to the first
  // incomplete step so a returning merchant isn't walked back through work
  // they've already done. Order: location (2) -> store photo (3) -> product (4).
  // Wait for the profile so we don't misjudge and start at step 1.
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!open) { initializedRef.current = false; return }
    if (initializedRef.current || !merchantProfile) return
    initializedRef.current = true
    let start = 1
    if (locationAlreadySet) {
      if (!photoAlreadySet) start = 3
      else if (!productDone) start = 4
    }
    setCurrentStep(start)
  }, [open, merchantProfile, locationAlreadySet, photoAlreadySet, productDone])

  const handleSkip = () => {
    onClose?.()
  }

  const handleNext = async () => {
    // Step 2 (location) is required - block advance until the pin is saved.
    if (currentStep === 2 && !locationSaved) {
      const ok = await saveLocation()
      if (!ok) return
    }
    // Step 3 (store photo) is required - block advance until the cover is saved.
    if (currentStep === 3 && !photoSaved) {
      const ok = await savePhoto()
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
      showErrorToast('Missing merchant context - try logging out and back in')
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

  const savePhoto = async () => {
    if (!photoData.coverImageUrl) {
      showErrorToast('Add a cover photo so customers can see your store')
      return false
    }
    if (!merchantId) {
      showErrorToast('Missing merchant context - try logging out and back in')
      return false
    }
    setLoading(true)
    try {
      // Persist via Redux so Layout's `coverMissing` signal flips immediately and
      // the dashboard banner self-dismisses. Logo is only sent when set (the
      // server validates it as a URL, so an empty string would be rejected).
      await dispatch(
        updateSettings({
          merchantId,
          coverImageUrl: photoData.coverImageUrl,
          ...(photoData.logoUrl ? { logoUrl: photoData.logoUrl } : {}),
        }),
      ).unwrap()
      setPhotoSaved(true)
      showSuccessToast('Store photo saved!')
      return true
    } catch (err) {
      showErrorToast(err?.message || 'Failed to save photo. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  // The first product is created through the real product modal
  // (ProductCreateModal), so it goes through the same Redux thunk and endpoint
  // as the Products page - and updates the store, which is what flips the
  // dashboard's "needs onboarding" signal off.
  const handleCreateProduct = async (payload) => {
    try {
      await dispatch(createProduct({ merchantId, productData: payload })).unwrap()
      showSuccessToast('First product added!')
      setOnboardingData((d) => ({ ...d, hasAddedProduct: true }))
      setShowProductModal(false)
    } catch (err) {
      showErrorToast(err?.message || 'Failed to add product. Please try again.')
    }
  }

  const handleComplete = () => {
    // Onboarding isn't complete without a cover photo or a first product - the
    // Complete button is disabled in these cases, but guard here too.
    if (!photoData.coverImageUrl) {
      showErrorToast('Add a cover photo to finish setup')
      return
    }
    if (!productDone) {
      showErrorToast('Add your first product to finish setup')
      return
    }
    showSuccessToast('Welcome to Logistics Platform! Your dashboard is ready.')
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
                Add your store photo
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                Add your first product
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
            This step is required - your business won't be approved or visible to customers until your location is pinned.
          </div>
        </div>
      )
    },
    {
      id: 3,
      icon: ImagePlus,
      title: 'Add Your Store Photo',
      description: 'A cover photo of what you sell or your business - this is the first thing customers see.',
      component: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
              Cover photo <span className="text-error">*</span>
            </label>
            <CloudinaryImageUploader
              kind="merchant_cover"
              value={photoData.coverImageUrl}
              onChange={(url) => {
                setPhotoData((d) => ({ ...d, coverImageUrl: url }))
                setPhotoSaved(false)
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text dark:text-dark-text mb-1">
              Logo <span className="font-normal text-muted dark:text-dark-muted">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <CloudinaryImageUploader
                kind="merchant_logo"
                size="sm"
                value={photoData.logoUrl}
                onChange={(url) => {
                  setPhotoData((d) => ({ ...d, logoUrl: url }))
                  setPhotoSaved(false)
                }}
              />
              <p className="text-sm text-muted dark:text-dark-muted">
                If you skip this, we'll use your business initial.
              </p>
            </div>
          </div>

          {photoSaved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
              <Check className="w-4 h-4 flex-shrink-0" />
              Photo saved. Click Next to continue.
            </div>
          )}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400">
            A cover photo is required - until you add one, customers see a generic
            default and your setup stays incomplete.
          </div>
        </div>
      )
    },
    {
      id: 4,
      icon: Package,
      title: 'Add Your First Product',
      description: 'Add at least one product so customers have something to order.',
      component: (
        <div className="space-y-6">
          {productDone ? (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-text dark:text-dark-text">
                  {onboardingData.hasAddedProduct ? 'First product added!' : "You're all set!"}
                </h4>
                <p className="text-sm text-muted dark:text-dark-muted mt-1">
                  You can add more anytime from the Products page. Click “Complete Setup” to finish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                disabled={!merchantCategory}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add another product
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-4 rounded-2xl border-2 border-dashed border-surface-muted dark:border-dark-surface-muted p-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 dark:bg-primary/20 rounded-full">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-text dark:text-dark-text">No products yet</h4>
                  <p className="text-sm text-muted dark:text-dark-muted mt-1">
                    Add your first product to open your store. You can't finish setup until you have at least one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  disabled={!merchantCategory}
                  className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-primary to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {merchantCategory ? 'Add your first product' : 'Loading…'}
                </button>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400">
                This step is required - your store needs at least one product before setup is complete.
              </div>
            </div>
          )}
        </div>
      )
    }
  ]

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface dark:bg-dark-surface border-b border-surface-muted dark:border-dark-surface-muted p-4 sm:p-6 rounded-t-3xl z-10">
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
                disabled={loading || !photoData.coverImageUrl || !productDone}
                title={
                  !photoData.coverImageUrl
                    ? 'Add a cover photo to finish'
                    : !productDone
                    ? 'Add your first product to finish'
                    : undefined
                }
                className="flex-1 py-3 bg-gradient-to-r from-success to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Complete Setup
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Skip Button - hidden on the required Location step (step 2) */}
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

    {/* The real product modal, reused from the Products page, layered on top
        of the wizard. Creating a product here marks the step complete. */}
    {showProductModal && (
      <ProductCreateModal
        category={merchantCategory}
        onClose={() => setShowProductModal(false)}
        onSubmit={handleCreateProduct}
      />
    )}
    </>
  )
}
