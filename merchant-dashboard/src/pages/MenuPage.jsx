import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton.jsx'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'
import ImageUpload from '../components/ImageUpload.jsx'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
} from '../store/slices/productsSlice.js'
import {
  Plus,
  X,
  Edit3,
  Trash2,
  Upload,
  Image as ImageIcon,
  Package,
  AlertCircle,
  TrendingUp,
  Star,
  Eye,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Search,
  Download,
  FileDown,
  Copy,
} from 'lucide-react'

export default function MenuPage() {
  const { merchantId } = useParams()
  const dispatch = useDispatch()
  const { products, loading } = useSelector((state) => state.products)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showInventory, setShowInventory] = useState(false)
  const [stockAdjustments, setStockAdjustments] = useState([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    images: [],
    stock: '',
    variants: [],
    modifiers: [],
    nutritionInfo: {},
    isCombo: false,
    comboItems: [],
  })

  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: ''
  })
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sortBy, setSortBy] = useState('name') // name, price, stock, category
  const [lowStockThreshold, setLowStockThreshold] = useState(10)
  const [showLowStockAlert, setShowLowStockAlert] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [stockAdjustments, setStockAdjustments] = useState([])

  useEffect(() => {
    dispatch(fetchProducts({ merchantId }))
    fetchCategories()
  }, [dispatch, merchantId])

  const fetchCategories = async () => {
    setCategoriesLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/merchants/${merchantId}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      } else {
        // Fallback to default categories if API fails
        setCategories([
          { id: 1, name: 'Appetizers', description: 'Starters and small bites' },
          { id: 2, name: 'Main Courses', description: 'Primary dishes' },
          { id: 3, name: 'Desserts', description: 'Sweet treats' },
          { id: 4, name: 'Beverages', description: 'Drinks and refreshments' },
          { id: 5, name: 'Specials', description: 'Chef\'s special items' }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      // Fallback to default categories
      setCategories([
        { id: 1, name: 'Appetizers', description: 'Starters and small bites' },
        { id: 2, name: 'Main Courses', description: 'Primary dishes' },
        { id: 3, name: 'Desserts', description: 'Sweet treats' },
        { id: 4, name: 'Beverages', description: 'Drinks and refreshments' },
        { id: 5, name: 'Specials', description: 'Chef\'s special items' }
      ])
    } finally {
      setCategoriesLoading(false)
    }
  }

  // Check for low stock items
  useEffect(() => {
    const lowStockItems = products.filter(product => 
      (product.stock || 0) <= lowStockThreshold && product.isAvailable !== false
    )
    
    if (lowStockItems.length > 0 && !showLowStockAlert) {
      setShowLowStockAlert(true)
    }
  }, [products, lowStockThreshold, showLowStockAlert])

  // Inventory management functions
  const handleStockUpdate = (productId, newStock, adjustmentType = 'manual') => {
    const adjustment = {
      id: Date.now(),
      productId,
      previousStock: products.find(p => p.id === productId)?.stock || 0,
      newStock,
      adjustmentType, // 'manual', 'order', 'reconciliation'
      timestamp: new Date().toISOString(),
      reason: adjustmentType === 'order' ? 'Order fulfillment' : 'Manual adjustment'
    }
    
    setStockAdjustments([adjustment, ...stockAdjustments])
    
    // Update product stock
    const updatedProducts = products.map(product => 
      product.id === productId ? { ...product, stock: newStock } : product
    )
    
    // In a real app, this would dispatch an action to update the backend
    showSuccessToast(`Stock updated for ${products.find(p => p.id === productId)?.name}`)
  }

  const handleBulkStockUpdate = (updates) => {
    updates.forEach(({ productId, newStock }) => {
      handleStockUpdate(productId, newStock, 'bulk')
    })
    showSuccessToast(`Bulk stock update completed for ${updates.length} products`)
  }

  const getLowStockItems = () => {
    return products.filter(product => 
      (product.stock || 0) <= lowStockThreshold && product.isAvailable !== false
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Upload images and get URLs
    const imageUrls = await uploadImages(formData.images)
    
    const productData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      category: formData.category,
      images: imageUrls,
      imageUrl: imageUrls[0] || '', // Keep imageUrl for backward compatibility
      stock: parseInt(formData.stock),
      variants: formData.variants,
      modifiers: formData.modifiers,
      nutritionInfo: formData.nutritionInfo,
      isCombo: formData.isCombo,
      comboItems: formData.comboItems,
    }

    try {
      if (editingProduct) {
        await dispatch(updateProduct({ merchantId, productId: editingProduct.id, productData })).unwrap()
        showSuccessToast('Product updated successfully')
      } else {
        await dispatch(createProduct({ merchantId, productData })).unwrap()
        showSuccessToast('Product created successfully')
      }
      setShowModal(false)
      setEditingProduct(null)
      setFormData({ 
        name: '', 
        description: '', 
        price: '', 
        category: '', 
        images: [], 
        stock: '',
        variants: [],
        modifiers: [],
        nutritionInfo: {},
        isCombo: false,
        comboItems: [],
      })
      dispatch(fetchProducts({ merchantId }))
    } catch (err) {
      console.error('Failed to save product:', err)
      showErrorToast('Failed to save product')
    }
  }

  const uploadImages = async (images) => {
    const uploadedImages = []
    
    for (const image of images) {
      try {
        const formData = new FormData()
        formData.append('image', image)
        formData.append('merchantId', merchantId)
        
        const token = localStorage.getItem('token')
        const response = await fetch('/api/upload/product-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
        
        if (response.ok) {
          const result = await response.json()
          uploadedImages.push({
            url: result.url,
            id: result.id,
            name: image.name
          })
        } else {
          // Fallback to blob URL if upload fails
          uploadedImages.push({
            url: URL.createObjectURL(image),
            id: Date.now() + Math.random(),
            name: image.name
          })
        }
      } catch (error) {
        console.error('Image upload failed:', error)
        // Fallback to blob URL
        uploadedImages.push({
          url: URL.createObjectURL(image),
          id: Date.now() + Math.random(),
          name: image.name
        })
      }
    }
    
    return uploadedImages
  }

  // Category management functions
  const handleAddCategory = () => {
    setEditingCategory(null)
    setCategoryFormData({ name: '', description: '' })
    setShowCategoryModal(true)
  }

  const handleEditCategory = (category) => {
    setEditingCategory(category)
    setCategoryFormData({ name: category.name, description: category.description })
    setShowCategoryModal(true)
  }

  const handleCategorySubmit = (e) => {
    e.preventDefault()
    if (editingCategory) {
      setCategories(categories.map(cat => 
        cat.id === editingCategory.id 
          ? { ...cat, name: categoryFormData.name, description: categoryFormData.description }
          : cat
      ))
      showSuccessToast('Category updated successfully')
    } else {
      const newCategory = {
        id: Date.now(),
        name: categoryFormData.name,
        description: categoryFormData.description
      }
      setCategories([...categories, newCategory])
      showSuccessToast('Category created successfully')
    }
    setShowCategoryModal(false)
    setCategoryFormData({ name: '', description: '' })
  }

  const handleDeleteCategory = (categoryId) => {
    if (confirm('Are you sure you want to delete this category? Products in this category will be uncategorized.')) {
      setCategories(categories.filter(cat => cat.id !== categoryId))
      showSuccessToast('Category deleted successfully')
    }
  }

  // Update filtering logic
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category === selectedCategory
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'price':
        return a.price - b.price
      case 'stock':
        return (a.stock || 0) - (b.stock || 0)
      case 'category':
        return (a.category || '').localeCompare(b.category || '')
      default:
        return 0
    }
  })

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category || '',
      images: product.images || [],
      stock: product.stock?.toString() || '0',
      variants: product.variants || [],
      modifiers: product.modifiers || [],
      nutritionInfo: product.nutritionInfo || {},
      isCombo: product.isCombo || false,
      comboItems: product.comboItems || [],
    })
    setShowModal(true)
  }

  const handleDelete = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await dispatch(deleteProduct({ merchantId, productId })).unwrap()
        dispatch(fetchProducts({ merchantId }))
      } catch (err) {
        showErrorToast('Failed to delete product. Please try again.')
      }
    }
  }

  const handleToggleAvailability = async (productId, isAvailable) => {
    try {
      await dispatch(toggleProductAvailability({ merchantId, productId, isAvailable })).unwrap()
      dispatch(fetchProducts({ merchantId }))
    } catch (err) {
      showErrorToast('Failed to toggle product availability. Please try again.')
    }
  }

  const handleFileImport = (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'text/csv') {
      setImportFile(file)
      parseCSV(file)
    } else {
      showErrorToast('Please select a valid CSV file')
    }
  }

  const parseCSV = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      
      const parsedData = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const product = {}
        
        headers.forEach((header, index) => {
          const value = values[index] || ''
          switch (header) {
            case 'name':
              product.name = value
              break
            case 'description':
              product.description = value
              break
            case 'price':
              product.price = parseFloat(value) || 0
              break
            case 'category':
              product.category = value
              break
            case 'stock':
              product.stock = parseInt(value) || 0
              break
            default:
              product[header] = value
          }
        })
        
        if (product.name) {
          parsedData.push(product)
        }
      }
      
      setImportPreview(parsedData.slice(0, 5)) // Show preview of first 5 items
    }
    reader.readAsText(file)
  }

  const handleBulkImport = async () => {
    if (!importFile) return
    
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('merchantId', merchantId)
      
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/merchants/${merchantId}/products/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      if (response.ok) {
        const result = await response.json()
        showSuccessToast(`Successfully imported ${result.imported} products`)
        dispatch(fetchProducts({ merchantId }))
        setShowImportModal(false)
        setImportFile(null)
        setImportPreview([])
      } else {
        throw new Error('Failed to import products')
      }
    } catch (err) {
      showErrorToast('Failed to import products')
    } finally {
      setIsImporting(false)
    }
  }

  const handleBulkExport = async (format = 'csv') => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/merchants/${merchantId}/products/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `products_export_${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showSuccessToast(`Products exported as ${format.toUpperCase()}`)
        setShowExportModal(false)
      } else {
        throw new Error('Failed to export products')
      }
    } catch (err) {
      showErrorToast('Failed to export products')
    }
  }

  const handleDuplicateProduct = (product) => {
    setEditingProduct({
      ...product,
      id: null,
      name: `${product.name} (Copy)`
    })
    setShowModal(true)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Menu Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleAddCategory}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Manage Categories
          </button>
          <button
            onClick={() => setShowInventory(true)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Inventory
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {showLowStockAlert && getLowStockItems().length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Low Stock Alert
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {getLowStockItems().length} product{getLowStockItems().length > 1 ? 's' : ''} running low on stock
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInventoryModal(true)}
                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
              >
                View Inventory
              </button>
              <button
                onClick={() => setShowLowStockAlert(false)}
                className="p-1 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
            />
          </div>
          
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
          
          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
            <option value="stock">Sort by Stock</option>
            <option value="category">Sort by Category</option>
          </select>
        </div>
        
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              !selectedCategory 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            All ({products.length})
          </button>
          {categories.map(category => {
            const count = products.filter(p => p.category === category.name).length
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === category.name 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {category.name} ({count})
              </button>
            )
          })}
        </div>
      </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
                {product.images && product.images.length > 0 ? (
                  <>
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {product.images.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded-full">
                        +{product.images.length - 1} more
                      </div>
                    )}
                  </>
                ) : product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">No image</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</h3>
                  <button
                    onClick={() => handleToggleAvailability(product.id, !product.isAvailable)}
                    className={`p-1 rounded transition-colors ${
                      product.isAvailable ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {product.isAvailable ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-blue-600">₦{product.price.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicateProduct(product)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Duplicate Product"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditingProduct(null)
                    setFormData({ 
                      name: '', 
                      description: '', 
                      price: '', 
                      category: '', 
                      images: [], 
                      stock: '',
                      variants: [],
                      modifiers: [],
                      nutritionInfo: {},
                      isCombo: false,
                      comboItems: [],
                    })
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>
                <ImageUpload
                  images={formData.images}
                  onChange={(images) => setFormData({ ...formData, images })}
                  maxImages={5}
                  maxSize={5 * 1024 * 1024}
                  showGallery={true}
                  enableCrop={true}
                  enableCompression={true}
                />
              </div>

              {/* Product Variants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Variants</label>
                <div className="space-y-2">
                  {formData.variants.map((variant, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Variant name (e.g., Small, Medium, Large)"
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants]
                          newVariants[index].name = e.target.value
                          setFormData({ ...formData, variants: newVariants })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) => {
                          const newVariants = [...formData.variants]
                          newVariants[index].price = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, variants: newVariants })
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                      />
                      <input
                        type="number"
                        placeholder="Stock"
                        min="0"
                        value={variant.stock}
                        onChange={(e) => {
                          const newVariants = [...formData.variants]
                          newVariants[index].stock = parseInt(e.target.value) || 0
                          setFormData({ ...formData, variants: newVariants })
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newVariants = formData.variants.filter((_, i) => i !== index)
                          setFormData({ ...formData, variants: newVariants })
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        variants: [...formData.variants, { name: '', price: 0, stock: 0 }]
                      })
                    }}
                    className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    + Add Variant
                  </button>
                </div>
              </div>

              {/* Product Modifiers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add-ons / Modifiers</label>
                <div className="space-y-2">
                  {formData.modifiers.map((modifier, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Modifier name (e.g., Extra Cheese, No Onions)"
                        value={modifier.name}
                        onChange={(e) => {
                          const newModifiers = [...formData.modifiers]
                          newModifiers[index].name = e.target.value
                          setFormData({ ...formData, modifiers: newModifiers })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        value={modifier.price}
                        onChange={(e) => {
                          const newModifiers = [...formData.modifiers]
                          newModifiers[index].price = parseFloat(e.target.value) || 0
                          setFormData({ ...formData, modifiers: newModifiers })
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newModifiers = formData.modifiers.filter((_, i) => i !== index)
                          setFormData({ ...formData, modifiers: newModifiers })
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        modifiers: [...formData.modifiers, { name: '', price: 0 }]
                      })
                    }}
                    className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    + Add Modifier
                  </button>
                </div>
              </div>

              {/* Combo/Bundle Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Combo/Bundle Settings</label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isCombo"
                      checked={formData.isCombo}
                      onChange={(e) => setFormData({ ...formData, isCombo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isCombo" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      This is a combo/bundle product
                    </label>
                  </div>
                  
                  {formData.isCombo && (
                    <div className="ml-6 space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select products included in this combo:
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                        {products.filter(p => !editingProduct || p.id !== editingProduct.id).map(product => (
                          <div key={product.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`combo-${product.id}`}
                              checked={formData.comboItems.some(item => item.id === product.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    comboItems: [...formData.comboItems, { 
                                      id: product.id, 
                                      name: product.name, 
                                      quantity: 1 
                                    }]
                                  })
                                } else {
                                  setFormData({
                                    ...formData,
                                    comboItems: formData.comboItems.filter(item => item.id !== product.id)
                                  })
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`combo-${product.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {product.name} - ₦{product.price.toLocaleString()}
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      {formData.comboItems.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Items:</p>
                          {formData.comboItems.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                                {item.name}
                              </span>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newComboItems = [...formData.comboItems]
                                  newComboItems[index].quantity = parseInt(e.target.value) || 1
                                  setFormData({ ...formData, comboItems: newComboItems })
                                }}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                              />
                              <span className="text-sm text-gray-500">qty</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Combo Savings: ₦{(formData.comboItems.reduce((sum, item) => {
                                const product = products.find(p => p.id === item.id)
                                return sum + (product ? product.price * item.quantity : 0)
                              }, 0) - parseFloat(formData.price || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingProduct(null)
                    setFormData({ 
                      name: '', 
                      description: '', 
                      price: '', 
                      category: '', 
                      images: [], 
                      stock: '',
                      variants: [],
                      modifiers: [],
                      nutritionInfo: {},
                      isCombo: false,
                      comboItems: [],
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingProduct ? 'Update' : 'Add'} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Category Form */}
              <form onSubmit={handleCategorySubmit} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingCategory ? 'Update' : 'Add'} Category
                  </button>
                </div>
              </form>

              {/* Existing Categories List */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Existing Categories
                </h3>
                <div className="space-y-2">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {category.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {category.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {products.filter(p => p.category === category.name).length} products
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Management Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Inventory Management
                </h2>
                <button
                  onClick={() => setShowInventoryModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Low Stock Threshold */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Low Stock Alert Threshold
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Alert when stock falls below this amount
                  </span>
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Low Stock Items ({getLowStockItems().length})
                </h3>
                {getLowStockItems().length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No items are currently low on stock
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getLowStockItems().map(product => (
                      <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {product.name}
                            </h4>
                            <p className="text-sm text-red-600 dark:text-red-400">
                              Current stock: {product.stock || 0}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            defaultValue={product.stock || 0}
                            onBlur={(e) => {
                              const newStock = parseInt(e.target.value) || 0
                              if (newStock !== (product.stock || 0)) {
                                handleStockUpdate(product.id, newStock)
                              }
                            }}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                          />
                          <span className="text-sm text-gray-500">units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All Products Stock */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  All Products Stock
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500">No img</span>
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {product.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {product.category || 'Uncategorized'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {product.stock || 0} units
                          </p>
                          {(product.stock || 0) <= lowStockThreshold && (
                            <p className="text-xs text-red-600 dark:text-red-400">Low stock</p>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          defaultValue={product.stock || 0}
                          onBlur={(e) => {
                            const newStock = parseInt(e.target.value) || 0
                            if (newStock !== (product.stock || 0)) {
                              handleStockUpdate(product.id, newStock)
                            }
                          }}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-dark-surface"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Adjustment History */}
              {stockAdjustments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Recent Stock Adjustments
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {stockAdjustments.slice(0, 10).map(adjustment => {
                      const product = products.find(p => p.id === adjustment.productId)
                      return (
                        <div key={adjustment.id} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                          <div>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {product?.name || 'Unknown Product'}
                            </span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                              {adjustment.previousStock} → {adjustment.newStock}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-600 dark:text-gray-400">{adjustment.reason}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(adjustment.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Analytics Section */}
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Product Analytics
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Best Sellers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Top Selling Products
            </h3>
            <div className="space-y-3">
              {products
                .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
                .slice(0, 5)
                .map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                        index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          ₦{product.price.toLocaleString()} each
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {product.orderCount || 0}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        orders
                      </p>
                    </div>
                  </div>
                ))}
              {products.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No products available</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Favorites */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Customer Favorites
            </h3>
            <div className="space-y-3">
              {products
                .sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0))
                .slice(0, 5)
                .map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Star className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {product.favoriteCount || 0} favorites
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {((product.favoriteCount || 0) / Math.max(product.viewCount || 1, 1) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        fav rate
                      </p>
                    </div>
                  </div>
                ))}
              {products.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No favorites data</p>
                </div>
              )}
            </div>
          </div>

          {/* Most Viewed Products */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Most Viewed Products
            </h3>
            <div className="space-y-3">
              {products
                .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
                .slice(0, 5)
                .map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {product.viewCount || 0} views
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {((product.orderCount || 0) / Math.max(product.viewCount || 1, 1) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        conversion
                      </p>
                    </div>
                  </div>
                ))}
              {products.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No view data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Performance Metrics */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Detailed Performance Metrics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Products
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {products.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min((products.length / 100) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Low Stock Items
                </span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {products.filter(p => (p.stock || 0) < 10).length}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full" 
                  style={{ width: `${products.length > 0 ? (products.filter(p => (p.stock || 0) < 10).length / products.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Out of Stock
                </span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {products.filter(p => (p.stock || 0) === 0).length}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{ width: `${products.length > 0 ? (products.filter(p => (p.stock || 0) === 0).length / products.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Revenue
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  ₦{products.reduce((sum, p) => sum + ((p.price || 0) * (p.orderCount || 0)), 0).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                From all product sales
              </p>
            </div>
          </div>

          {/* Conversion Rate Analysis */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Conversion Rate Analysis
              </h4>
              <div className="space-y-2">
                {products
                  .filter(p => (p.viewCount || 0) > 0)
                  .sort((a, b) => ((b.orderCount || 0) / Math.max(b.viewCount || 1, 1)) - ((a.orderCount || 0) / Math.max(a.viewCount || 1, 1)))
                  .slice(0, 3)
                  .map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {product.name}
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {((product.orderCount || 0) / Math.max(product.viewCount || 1, 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                {products.filter(p => (p.viewCount || 0) > 0).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No conversion data available</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Engagement Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Total Views</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {products.reduce((sum, p) => sum + (p.viewCount || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Total Favorites</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {products.reduce((sum, p) => sum + (p.favoriteCount || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">Avg Conversion Rate</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {products.length > 0 ? 
                      (products.reduce((sum, p) => sum + ((p.orderCount || 0) / Math.max(p.viewCount || 1, 1)), 0) / products.length * 100).toFixed(1) 
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Import Products from CSV
                </h2>
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                    setImportPreview([])
                  }}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileImport}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  CSV should contain columns: name, description, price, category, stock
                </p>
              </div>

              {importPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview (First 5 items)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2">Name</th>
                          <th className="text-left py-2">Price</th>
                          <th className="text-left py-2">Category</th>
                          <th className="text-left py-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((product, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2">{product.name}</td>
                            <td className="py-2">₦{product.price?.toLocaleString()}</td>
                            <td className="py-2">{product.category}</td>
                            <td className="py-2">{product.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                    setImportPreview([])
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!importFile || isImporting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? 'Importing...' : 'Import Products'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Export Products
                </h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Export all products data for backup or analysis.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleBulkExport('csv')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export as CSV
                </button>
                <button
                  onClick={() => handleBulkExport('json')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export as JSON
                </button>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
