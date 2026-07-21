import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api'
import { useSelector, useDispatch } from 'react-redux'
import { fetchOrders, acceptOrder, rejectOrder, updateOrderStatus } from '../store/slices/ordersSlice.js'
import {
  Check,
  X,
  Clock,
  Package,
  Filter,
  RefreshCw,
  Eye,
  Search,
  Calendar,
  DollarSign,
  Printer,
  XCircle,
  Edit3,
  Plus,
  Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { TableSkeleton } from '../components/LoadingSkeleton.jsx'
import NumberInput from '../components/NumberInput.jsx'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'
import { useSocketContext } from '../contexts/SocketContext.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import OrderDetailsModal from '../components/OrderDetailsModal.jsx'

export default function OrdersPage() {
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  const dispatch = useDispatch()
  const { orders, loading, total, page, limit } = useSelector((state) => state.orders)
  const [filter, setFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState(new Set())
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [showOrderModification, setShowOrderModification] = useState(false)
  const [modifyingOrder, setModifyingOrder] = useState(null)
  const [modifiedOrderData, setModifiedOrderData] = useState({
    items: [],
    specialInstructions: '',
    notes: '',
    deliveryAddress: ''
  })
  const [exportFields, setExportFields] = useState({
    orderId: true,
    customer: true,
    status: true,
    total: true,
    date: true,
    items: true,
    deliveryLocation: false,
    specialInstructions: false
  })
  
  // Shared socket connection - lives at Layout level (see SocketContext.jsx)
  // so it survives navigation away from this page instead of tearing down.
  const { isConnected, connectionStatus, reconnect } = useSocketContext()

  useEffect(() => {
    const params = {
      merchantId,
      status: filter || undefined,
      search: searchTerm || undefined,
      startDate: dateRange.start || undefined,
      endDate: dateRange.end || undefined,
      minPrice: priceRange.min || undefined,
      maxPrice: priceRange.max || undefined,
    }
    
    // Remove undefined values
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
    
    dispatch(fetchOrders(params))
  }, [dispatch, merchantId, filter, searchTerm, dateRange, priceRange])

  const handleAccept = async (orderId) => {
    try {
      await dispatch(acceptOrder({ merchantId, requestId: orderId })).unwrap()
    } catch (err) {
      showErrorToast('Failed to accept order. Please try again.')
    }
  }

  const handleReject = async (orderId) => {
    const reason = prompt('Enter reason for rejection:')
    if (reason) {
      try {
        await dispatch(rejectOrder({ merchantId, requestId: orderId, reason })).unwrap()
      } catch (err) {
        showErrorToast('Failed to reject order. Please try again.')
      }
    }
  }

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await dispatch(updateOrderStatus({ merchantId, requestId: orderId, status })).unwrap()
    } catch (err) {
      showErrorToast('Failed to update order status. Please try again.')
    }
  }

  const handleModifyOrder = (order) => {
    setModifyingOrder(order)
    setModifiedOrderData({
      items: [...order.items],
      specialInstructions: order.specialInstructions || '',
      notes: order.notes || '',
      deliveryAddress: order.deliveryLocation?.address || ''
    })
    setShowOrderModification(true)
  }

  const handleSaveOrderModification = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${modifyingOrder.id}/modify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modifiedOrderData)
      })
      
      if (response.ok) {
        // Refresh orders to show updated data
        dispatch(fetchOrders({ merchantId }))
        setShowOrderModification(false)
        showSuccessToast('Order modified successfully')
      } else {
        throw new Error('Failed to modify order')
      }
    } catch (err) {
      showErrorToast('Failed to modify order. Please try again.')
    }
  }

  const handleAddItem = () => {
    setModifiedOrderData({
      ...modifiedOrderData,
      items: [
        ...modifiedOrderData.items,
        {
          id: Date.now(),
          name: '',
          price: '',
          quantity: 1,
          customItem: true
        }
      ]
    })
  }

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...modifiedOrderData.items]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    }
    setModifiedOrderData({
      ...modifiedOrderData,
      items: updatedItems
    })
  }

  const handleRemoveItem = (index) => {
    const updatedItems = modifiedOrderData.items.filter((_, i) => i !== index)
    setModifiedOrderData({
      ...modifiedOrderData,
      items: updatedItems
    })
  }

  const handleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(order => order.id)))
    }
  }

  const handleBulkAction = (action) => {
    if (selectedOrders.size === 0) {
      showErrorToast('Please select at least one order')
      return
    }
    setBulkAction(action)
    setShowBulkActionModal(true)
  }

  const executeBulkAction = async () => {
    try {
      const orderIds = Array.from(selectedOrders)
      
      if (bulkAction === 'accept') {
        await Promise.all(orderIds.map(id => dispatch(acceptOrder({ merchantId, requestId: id })).unwrap()))
        showSuccessToast(`${orderIds.length} orders accepted successfully`)
      } else if (bulkAction === 'reject') {
        await Promise.all(orderIds.map(id => dispatch(rejectOrder({ merchantId, requestId: id })).unwrap()))
        showSuccessToast(`${orderIds.length} orders rejected successfully`)
      } else if (bulkAction === 'cancel') {
        await Promise.all(orderIds.map(id => dispatch(updateOrderStatus({ merchantId, requestId: id, status: 'CANCELLED' })).unwrap()))
        showSuccessToast(`${orderIds.length} orders cancelled successfully`)
      }
      
      setShowBulkActionModal(false)
      setSelectedOrders(new Set())
      dispatch(fetchOrders({ merchantId }))
    } catch (err) {
      showErrorToast(`Failed to ${bulkAction} orders. Please try again.`)
    }
  }

  const handleCancelOrder = async (orderId) => {
    try {
      await dispatch(updateOrderStatus({ merchantId, requestId: orderId, status: 'CANCELLED' })).unwrap()
      showSuccessToast('Order cancelled successfully')
    } catch (err) {
      showErrorToast('Failed to cancel order. Please try again.')
    }
  }

  const handlePrintReceipt = (order) => {
    const printWindow = window.open('', '_blank')
    const receiptContent = `
      <html>
        <head>
          <title>Order Receipt #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .order-details { margin-bottom: 20px; }
            .items { border-top: 1px solid #ccc; padding-top: 10px; }
            .total { text-align: right; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order Receipt</h1>
            <p>Order #${order.id}</p>
            <p>${new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div class="order-details">
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
          </div>
          <div class="items">
            <h3>Items</h3>
            ${order.items.map(item => `<p>${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</p>`).join('')}
          </div>
          <div class="total">
            <p>Total: $${order.total.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `
    printWindow.document.write(receiptContent)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExport = () => {
    setShowExportModal(true)
  }

  const executeExport = () => {
    const ordersToExport = selectedOrders.size > 0 ? 
      orders.filter(order => selectedOrders.has(order.id)) : 
      orders

    if (exportFormat === 'csv') {
      exportToCSV(ordersToExport)
    } else if (exportFormat === 'pdf') {
      exportToPDF(ordersToExport)
    }
    
    setShowExportModal(false)
  }

  const exportToCSV = (ordersToExport) => {
    const headers = []
    const rows = []

    // Build headers based on selected fields
    if (exportFields.orderId) headers.push('Order ID')
    if (exportFields.customer) headers.push('Customer Name')
    if (exportFields.customer) headers.push('Customer Email')
    if (exportFields.customer) headers.push('Customer Phone')
    if (exportFields.status) headers.push('Status')
    if (exportFields.total) headers.push('Total')
    if (exportFields.date) headers.push('Order Date')
    if (exportFields.items) headers.push('Items')
    if (exportFields.deliveryLocation) headers.push('Delivery Address')
    if (exportFields.specialInstructions) headers.push('Special Instructions')

    // Build rows
    ordersToExport.forEach(order => {
      const row = []
      
      if (exportFields.orderId) row.push(`#${order.id.slice(0, 8)}`)
      if (exportFields.customer) {
        row.push(`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim())
        row.push(order.customer?.email || '')
        row.push(order.customer?.phone || '')
      }
      if (exportFields.status) row.push(order.status?.replace(/_/g, ' ') || '')
      if (exportFields.total) row.push(order.total?.toString() || '0')
      if (exportFields.date) row.push(format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss'))
      if (exportFields.items) {
        const itemsText = order.items?.map(item => 
          `${item.name} x${item.quantity} (₦${item.price})`
        ).join('; ') || ''
        row.push(itemsText)
      }
      if (exportFields.deliveryLocation) row.push(order.deliveryLocation?.address || '')
      if (exportFields.specialInstructions) row.push(order.specialInstructions || '')
      
      rows.push(row)
    })

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showSuccessToast('Orders exported successfully')
  }

  const exportToPDF = (ordersToExport) => {
    // For now, we'll create a simple text-based PDF export
    // In a real application, you'd use a library like jsPDF
    let pdfContent = 'ORDERS EXPORT REPORT\n'
    pdfContent += `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`
    pdfContent += `Total Orders: ${ordersToExport.length}\n\n`
    pdfContent += '=' .repeat(80) + '\n\n'

    ordersToExport.forEach((order, index) => {
      pdfContent += `Order #${index + 1}\n`
      pdfContent += `Order ID: #${order.id.slice(0, 8)}\n`
      
      if (exportFields.customer) {
        pdfContent += `Customer: ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}\n`
        pdfContent += `Email: ${order.customer?.email || 'N/A'}\n`
        pdfContent += `Phone: ${order.customer?.phone || 'N/A'}\n`
      }
      
      if (exportFields.status) pdfContent += `Status: ${order.status?.replace(/_/g, ' ') || 'N/A'}\n`
      if (exportFields.total) pdfContent += `Total: ₦${order.total || '0'}\n`
      if (exportFields.date) pdfContent += `Date: ${format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss')}\n`
      
      if (exportFields.items && order.items) {
        pdfContent += 'Items:\n'
        order.items.forEach(item => {
          pdfContent += `  - ${item.name} x${item.quantity} = ₦${item.price * item.quantity}\n`
        })
      }
      
      if (exportFields.deliveryLocation) {
        pdfContent += `Delivery Address: ${order.deliveryLocation?.address || 'N/A'}\n`
      }
      
      if (exportFields.specialInstructions) {
        pdfContent += `Special Instructions: ${order.specialInstructions || 'None'}\n`
      }
      
      pdfContent += '\n' + '-'.repeat(40) + '\n\n'
    })

    // Create and download PDF receipt
    const blob = new Blob([pdfContent], { type: 'text/plain;charset=utf-8;' })
    // Note: In production, replace with proper PDF library like jsPDF
    // For now, using text format as PDF placeholder
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `orders_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.txt`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showSuccessToast('Orders exported successfully (PDF format - text file)')
  }

  const getStatusColor = (status) => {
    const colors = {
      REQUESTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      ACCEPTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      READY_FOR_PICKUP: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      RIDER_ASSIGNED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    return colors[status] || 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'
  }

  // Open the detail modal for a row. Wired to the whole row/card (below) so the
  // merchant doesn't have to hunt for the eye icon - the interactive controls
  // (checkbox, action buttons) stopPropagation so they still work independently.
  const openDetails = (order) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  // Shared row actions - rendered both in the desktop table and the mobile
  // card list so the two layouts never drift apart.
  const renderOrderActions = (order) => (
    <>
      <button
        onClick={() => { setSelectedOrder(order); setShowOrderDetails(true) }}
        className="p-2 text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => handlePrintReceipt(order)}
        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        title="Print Receipt"
      >
        <Printer className="w-4 h-4" />
      </button>
      {order.status === 'REQUESTED' && (
        <>
          <button
            onClick={() => handleAccept(order.id)}
            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="Accept Order"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleReject(order.id)}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Reject Order"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      {(order.status === 'REQUESTED' || order.status === 'ACCEPTED') && (
        <>
          <button
            onClick={() => handleModifyOrder(order)}
            className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            title="Modify Order"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleCancelOrder(order.id)}
            className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
            title="Cancel Order"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </>
      )}
      {order.status === 'ACCEPTED' && (
        <button
          onClick={() => handleStatusUpdate(order.id, 'PROCESSING')}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Process
        </button>
      )}
      {order.status === 'PROCESSING' && (
        <button
          onClick={() => handleStatusUpdate(order.id, 'READY_FOR_PICKUP')}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Ready
        </button>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-dark-text">Orders</h1>
          <p className="text-muted dark:text-dark-muted">Manage incoming and ongoing orders</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus 
            isConnected={isConnected} 
            connectionStatus={connectionStatus} 
            onReconnect={reconnect} 
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted dark:text-dark-muted" />
            <input
              type="text"
              placeholder="Search by order ID or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
            />
          </div>
          
          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted dark:text-dark-muted" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
            >
              <option value="">All Status</option>
              <option value="REQUESTED">Requested</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PROCESSING">Processing</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="RIDER_ASSIGNED">Rider Assigned</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
          >
            Advanced Filters
          </button>
          
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Export
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={() => {
              const params = {
                merchantId,
                status: filter || undefined,
                search: searchTerm || undefined,
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined,
                minPrice: priceRange.min || undefined,
                maxPrice: priceRange.max || undefined,
              }
              
              Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
              
              dispatch(fetchOrders(params))
            }}
            className="p-2 text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bulk Action Buttons */}
      {selectedOrders.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/10 dark:bg-primary/10 px-3 py-2 rounded-lg">
          <span className="text-sm text-primary dark:text-primary font-medium">
            {selectedOrders.size} selected
          </span>
          <button
            onClick={() => handleBulkAction('accept')}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={() => handleBulkAction('reject')}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            Reject All
          </button>
          <button
            onClick={() => handleBulkAction('cancel')}
            className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
          >
            Cancel All
          </button>
          <button
            onClick={() => setSelectedOrders(new Set())}
            className="px-3 py-1 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text text-sm"
          >
            Clear
          </button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Min Price</label>
              <NumberInput
                decimal
                placeholder="₦0"
                value={priceRange.min}
                onChange={(val) => setPriceRange({ ...priceRange, min: val })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">Max Price</label>
              <NumberInput
                decimal
                placeholder="₦100,000"
                value={priceRange.max}
                onChange={(val) => setPriceRange({ ...priceRange, max: val })}
                className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                const params = {
                  merchantId,
                  status: filter || undefined,
                  search: searchTerm || undefined,
                  startDate: dateRange.start || undefined,
                  endDate: dateRange.end || undefined,
                  minPrice: priceRange.min || undefined,
                  maxPrice: priceRange.max || undefined,
                }
                
                Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
                
                dispatch(fetchOrders(params))
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setDateRange({ start: '', end: '' })
                setPriceRange({ min: '', max: '' })
                dispatch(fetchOrders({ merchantId, status: filter, search: searchTerm }))
              }}
              className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted dark:text-dark-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text dark:text-dark-text">No orders found</h3>
          <p className="text-muted dark:text-dark-muted">Orders will appear here when customers place them</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === orders.length && orders.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                {orders.map((order) => (
                  <tr key={order.id} onClick={() => openDetails(order)} className={`cursor-pointer hover:bg-surface-muted dark:hover:bg-dark-surface-muted ${selectedOrders.has(order.id) ? 'bg-primary/10 dark:bg-primary/10' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                      #{order.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {order.customer?.firstName} {order.customer?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-text dark:text-dark-text">
                      ₦{order.total?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {format(new Date(order.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {renderOrderActions(order)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list - replaces the horizontal-scroll table below md */}
          <div className="md:hidden divide-y divide-surface-muted dark:divide-dark-surface-muted">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => openDetails(order)}
                className={`p-4 space-y-3 cursor-pointer ${selectedOrders.has(order.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                      className="w-4 h-4 shrink-0 text-primary border-surface-muted rounded focus:ring-primary"
                    />
                    <span className="text-sm font-semibold text-text dark:text-dark-text truncate">
                      #{order.id.slice(0, 8)}
                    </span>
                  </label>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted dark:text-dark-muted truncate">
                    {order.customer?.firstName} {order.customer?.lastName}
                  </span>
                  <span className="font-semibold text-text dark:text-dark-text shrink-0">
                    ₦{order.total?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="text-xs text-muted dark:text-dark-muted">
                  {format(new Date(order.createdAt), 'MMM dd, yyyy • h:mm a')}
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-surface-muted dark:border-dark-surface-muted" onClick={(e) => e.stopPropagation()}>
                  {renderOrderActions(order)}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-surface-muted dark:border-dark-surface-muted flex items-center justify-between gap-3">
            <p className="text-sm text-muted dark:text-dark-muted">
              Showing {orders.length} of {total} orders
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => dispatch(fetchOrders({ merchantId, status: filter || undefined, page: page - 1 }))}
                className="px-3 py-1 text-sm border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page * limit >= total}
                onClick={() => dispatch(fetchOrders({ merchantId, status: filter || undefined, page: page + 1 }))}
                className="px-3 py-1 text-sm border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkActionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-xl shadow-xl p-6 w-full sm:max-w-md max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Confirm Bulk Action
              </h3>
              <p className="text-muted dark:text-dark-muted mt-1">
                Are you sure you want to {bulkAction} {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''}?
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkActionModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                className={`px-4 py-2 text-white rounded-lg font-medium ${
                  bulkAction === 'accept' ? 'bg-green-600 hover:bg-green-700' :
                  bulkAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {bulkAction === 'accept' ? 'Accept' : bulkAction === 'reject' ? 'Reject' : 'Cancel'} {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-xl shadow-xl p-6 w-full sm:max-w-md max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text">
                Export Orders
              </h3>
              <p className="text-muted dark:text-dark-muted mt-1">
                Export {selectedOrders.size > 0 ? selectedOrders.size : orders.length} order{selectedOrders.size > 1 || orders.length > 1 ? 's' : ''}
              </p>
            </div>

            {/* Export Format */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                Export Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`flex-1 px-3 py-2 rounded-lg border ${
                    exportFormat === 'csv'
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary'
                      : 'border-surface-muted text-text dark:border-dark-surface-muted dark:text-dark-text'
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex-1 px-3 py-2 rounded-lg border ${
                    exportFormat === 'pdf'
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary'
                      : 'border-surface-muted text-text dark:border-dark-surface-muted dark:text-dark-text'
                  }`}
                >
                  PDF
                </button>
              </div>
            </div>

            {/* Export Fields */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                Export Fields
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.orderId}
                    onChange={(e) => setExportFields({...exportFields, orderId: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Order ID</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.customer}
                    onChange={(e) => setExportFields({...exportFields, customer: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Customer Information</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.status}
                    onChange={(e) => setExportFields({...exportFields, status: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Order Status</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.total}
                    onChange={(e) => setExportFields({...exportFields, total: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Total Amount</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.date}
                    onChange={(e) => setExportFields({...exportFields, date: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Order Date</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.items}
                    onChange={(e) => setExportFields({...exportFields, items: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Order Items</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.deliveryLocation}
                    onChange={(e) => setExportFields({...exportFields, deliveryLocation: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Delivery Location</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFields.specialInstructions}
                    onChange={(e) => setExportFields({...exportFields, specialInstructions: e.target.checked})}
                    className="w-4 h-4 text-primary border-surface-muted rounded focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text dark:text-dark-text">Special Instructions</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={executeExport}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => { setShowOrderDetails(false); setSelectedOrder(null) }}
        />
      )}

      {/* Order Modification Modal */}
      {showOrderModification && modifyingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-4xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-text dark:text-dark-text">
                  Modify Order #{modifyingOrder.id.slice(0, 8)}
                </h2>
                <button
                  onClick={() => setShowOrderModification(false)}
                  className="p-2 text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text dark:text-dark-text">Order Items</h3>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {modifiedOrderData.items.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 p-4 bg-surface-muted dark:bg-dark-surface-muted rounded-lg">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          placeholder="Item name"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                          className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                        />
                        <NumberInput
                          decimal
                          placeholder="Price"
                          value={item.price}
                          onChange={(val) => handleUpdateItem(index, 'price', val === '' ? '' : parseFloat(val) || 0)}
                          className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                        />
                        <NumberInput
                          placeholder="Quantity"
                          value={item.quantity}
                          onChange={(val) => handleUpdateItem(index, 'quantity', parseInt(val) || 1)}
                          className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                        />
                        <div className="text-sm font-medium text-text dark:text-dark-text py-2">
                          Total: ₦{(item.price * item.quantity).toLocaleString()}
                        </div>
                      </div>
                      {item.customItem && (
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={modifiedOrderData.specialInstructions}
                  onChange={(e) => setModifiedOrderData({
                    ...modifiedOrderData,
                    specialInstructions: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                  placeholder="Add special instructions for this order..."
                />
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Order Notes (Internal)
                </label>
                <textarea
                  value={modifiedOrderData.notes}
                  onChange={(e) => setModifiedOrderData({
                    ...modifiedOrderData,
                    notes: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                  placeholder="Add internal notes about this order..."
                />
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Delivery Address
                </label>
                <textarea
                  value={modifiedOrderData.deliveryAddress}
                  onChange={(e) => setModifiedOrderData({
                    ...modifiedOrderData,
                    deliveryAddress: e.target.value
                  })}
                  rows={2}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text dark:text-dark-text"
                  placeholder="Update delivery address..."
                />
              </div>

              {/* Order Summary */}
              <div className="bg-surface-muted dark:bg-dark-surface-muted rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-text dark:text-dark-text">
                    New Total:
                  </span>
                  <span className="text-xl font-bold text-primary">
                    ₦{modifiedOrderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowOrderModification(false)}
                  className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOrderModification}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
