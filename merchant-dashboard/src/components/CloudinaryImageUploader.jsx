import { useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import api from '../lib/api.js'
import { showErrorToast } from '../utils/toast.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const maxDim = 1200
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.85
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

const uploadToCloudinary = async (file, sig) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.apiKey)
  formData.append('timestamp', sig.timestamp)
  formData.append('signature', sig.signature)
  formData.append('folder', sig.folder)
  formData.append('public_id', sig.publicId)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    throw new Error(`Cloudinary upload failed: ${errText}`)
  }
  const data = await res.json()
  return data.secure_url
}

/**
 * Direct-to-Cloudinary image uploader. Two-step flow:
 *   1. GET signed params from `/auth/upload-signature?kind=product`
 *   2. POST the (compressed) file straight to Cloudinary
 * The `secure_url` is fed back via `onChange`. The form persists only the URL.
 *
 * `size` controls thumbnail footprint:
 *   - "lg" (default): full-width upload zone with preview - for the main product image
 *   - "sm": compact 56×56 square - for variant / option-item rows
 */
export default function CloudinaryImageUploader({
  value,
  onChange,
  size = 'lg',
  disabled = false,
  label,
  kind = 'product',
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const pick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      return showErrorToast('Use JPEG, PNG, or WebP')
    }
    if (file.size > MAX_SIZE) {
      return showErrorToast(`Image is too large (max ${MAX_SIZE / 1024 / 1024}MB)`)
    }

    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const sigRes = await api.post('/auth/upload-signature', { kind })
      const sig = sigRes.data.data
      const url = await uploadToCloudinary(compressed, sig)
      onChange(url)
    } catch (err) {
      showErrorToast(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const clear = (e) => {
    e.stopPropagation()
    onChange('')
  }

  if (size === 'sm') {
    return (
      <button
        type="button"
        onClick={pick}
        disabled={disabled || uploading}
        title={value ? 'Replace image' : 'Add image'}
        className="relative w-14 h-14 rounded-md border border-surface-muted dark:border-dark-surface-muted bg-surface-muted dark:bg-dark-surface-muted overflow-hidden flex items-center justify-center group disabled:opacity-50"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFile}
          className="hidden"
        />
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            {!uploading && (
              <span
                onClick={clear}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </span>
            )}
          </>
        ) : uploading ? (
          <Loader2 size={18} className="animate-spin text-muted dark:text-dark-muted" />
        ) : (
          <ImageIcon size={18} className="text-muted dark:text-dark-muted" />
        )}
        {uploading && value && (
          <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-white" />
          </span>
        )}
      </button>
    )
  }

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFile}
        className="hidden"
      />
      {value ? (
        <div className="relative w-full aspect-video sm:aspect-[3/2] rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted bg-surface-muted dark:bg-dark-surface-muted">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="px-3 py-1.5 bg-white text-text rounded-md text-sm font-medium shadow disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={uploading}
              className="px-3 py-1.5 bg-error text-white rounded-md text-sm font-medium shadow disabled:opacity-60"
            >
              Remove
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={disabled || uploading}
          className="w-full aspect-video sm:aspect-[3/2] rounded-lg border-2 border-dashed border-surface-muted dark:border-dark-surface-muted hover:border-primary dark:hover:border-primary bg-surface-muted/40 dark:bg-dark-surface-muted/40 flex flex-col items-center justify-center gap-2 text-muted dark:text-dark-muted disabled:opacity-50 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Uploading…</span>
            </>
          ) : (
            <>
              <Upload size={24} />
              <span className="text-sm font-medium">Click to upload</span>
              <span className="text-xs">JPEG, PNG, WebP · up to 5MB</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
