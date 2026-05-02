import { useState, useRef, useCallback } from 'react'
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Crop, 
  RotateCw, 
  ZoomIn, 
  ZoomOut,
  Download,
  Trash2
} from 'lucide-react'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'

export default function ImageUpload({ 
  images = [], 
  onChange, 
  maxImages = 5, 
  maxSize = 5 * 1024 * 1024, // 5MB
  allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  showGallery = true,
  enableCrop = true,
  enableCompression = true
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    handleFiles(files)
  }

  const handleFiles = async (files) => {
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        showErrorToast(`Invalid file type: ${file.name}. Only JPEG, PNG, and WebP are allowed.`)
        return false
      }
      if (file.size > maxSize) {
        showErrorToast(`File too large: ${file.name}. Maximum size is ${maxSize / (1024 * 1024)}MB.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    if (images.length + validFiles.length > maxImages) {
      showErrorToast(`Maximum ${maxImages} images allowed.`)
      return
    }

    setUploading(true)

    try {
      const processedImages = await Promise.all(
        validFiles.map(file => processImage(file))
      )
      
      const newImages = [...images, ...processedImages]
      onChange(newImages)
      showSuccessToast(`${processedImages.length} image(s) uploaded successfully`)
    } catch (error) {
      showErrorToast('Failed to process images')
    } finally {
      setUploading(false)
    }
  }

  const processImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Compression logic
          let { width, height } = img
          const maxWidth = 1200
          const maxHeight = 1200
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width *= ratio
            height *= ratio
          }
          
          canvas.width = width
          canvas.height = height
          
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to blob with compression
          canvas.toBlob((blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            
            resolve({
              id: Date.now() + Math.random(),
              url: URL.createObjectURL(compressedFile),
              file: compressedFile,
              name: file.name,
              size: compressedFile.size,
              width,
              height,
              uploadedAt: new Date().toISOString()
            })
          }, 'image/jpeg', 0.8)
        }
        
        img.onerror = reject
        img.src = e.target.result
      }
      
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
    showSuccessToast('Image removed')
  }

  const setPrimaryImage = (index) => {
    const newImages = [...images]
    const [primaryImage] = newImages.splice(index, 1)
    newImages.unshift(primaryImage)
    onChange(newImages)
    showSuccessToast('Primary image updated')
  }

  const downloadImage = (image) => {
    const link = document.createElement('a')
    link.href = image.url
    link.download = image.name
    link.click()
  }

  const openCropModal = (index) => {
    setCurrentImageIndex(index)
    setPreviewImage(images[index])
    setShowCropModal(true)
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-2">
          <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {uploading ? 'Processing images...' : 'Drop images here or click to upload'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maximum {maxImages} images, up to {maxSize / (1024 * 1024)}MB each
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Supported formats: JPEG, PNG, WebP
            </p>
          </div>
          {!uploading && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select Images
            </button>
          )}
        </div>
      </div>

      {/* Image Gallery */}
      {showGallery && images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Images ({images.length}/{maxImages})
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              First image will be the primary
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  {index !== 0 && (
                    <button
                      onClick={() => setPrimaryImage(index)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                      title="Set as primary"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-700" />
                    </button>
                  )}
                  
                  {enableCrop && (
                    <button
                      onClick={() => openCropModal(index)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                      title="Crop image"
                    >
                      <Crop className="w-4 h-4 text-gray-700" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => downloadImage(image)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                    title="Download image"
                  >
                    <Download className="w-4 h-4 text-gray-700" />
                  </button>
                  
                  <button
                    onClick={() => removeImage(index)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                
                {/* Primary badge */}
                {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                    Primary
                  </div>
                )}
                
                {/* Image info */}
                <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-75 rounded p-1">
                  <p className="text-xs text-white truncate">
                    {image.width}×{image.height} • {(image.size / 1024).toFixed(1)}KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crop Modal (Simplified - would need actual cropping library) */}
      {showCropModal && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Crop Image
                </h3>
                <button
                  onClick={() => setShowCropModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <img
                    src={previewImage.url}
                    alt="Crop preview"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
                
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => setShowCropModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Apply crop using canvas
                      const canvas = document.createElement('canvas')
                      const ctx = canvas.getContext('2d')
                      const img = new Image()
                      
                      img.onload = () => {
                        // Calculate crop dimensions
                        const cropSize = Math.min(img.width, img.height) * 0.8
                        const startX = (img.width - cropSize) / 2
                        const startY = (img.height - cropSize) / 2
                        
                        canvas.width = cropSize
                        canvas.height = cropSize
                        
                        ctx.drawImage(img, startX, startY, cropSize, cropSize, 0, 0, cropSize, cropSize)
                        
                        canvas.toBlob((blob) => {
                          const croppedFile = new File([blob], images[currentImageIndex].name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                          })
                          
                          const newImages = [...images]
                          newImages[currentImageIndex] = croppedFile
                          onChange(newImages)
                          
                          showSuccessToast('Image cropped successfully')
                          setShowCropModal(false)
                        }, 'image/jpeg', 0.9)
                      }
                      
                      img.src = URL.createObjectURL(images[currentImageIndex])
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
