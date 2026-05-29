import { useState, useEffect } from 'react'
import { API_URL } from '../lib/api'
import { 
  X, 
  Phone, 
  MessageSquare, 
  MapPin, 
  Clock, 
  User, 
  Package,
  CheckCircle,
  AlertCircle,
  Truck,
  Star,
  Edit3,
  Save,
  XCircle,
  Plus,
  Send
} from 'lucide-react'
import { format } from 'date-fns'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'

export default function OrderDetailsModal({ order, onClose }) {
  const [orderNotes, setOrderNotes] = useState(order?.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState(order?.specialInstructions || '')
  const [isEditingInstructions, setIsEditingInstructions] = useState(false)
  const [priority, setPriority] = useState(order?.priority || 'NORMAL')
  const [isEditingPriority, setIsEditingPriority] = useState(false)
  const [comments, setComments] = useState(order?.comments || [])
  const [newComment, setNewComment] = useState('')
  const [showAddComment, setShowAddComment] = useState(false)

  if (!order) return null

  const handleSaveNotes = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${order.id}/notes`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: orderNotes })
      })
      
      if (response.ok) {
        showSuccessToast('Order notes updated successfully')
        setIsEditingNotes(false)
        // Update the order object with new notes
        order.notes = orderNotes
      } else {
        throw new Error('Failed to update notes')
      }
    } catch (err) {
      showErrorToast('Failed to update order notes')
    }
  }

  const handleSaveInstructions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${order.id}/instructions`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ specialInstructions })
      })
      
      if (response.ok) {
        showSuccessToast('Special instructions updated successfully')
        setIsEditingInstructions(false)
        // Update the order object with new instructions
        order.specialInstructions = specialInstructions
      } else {
        throw new Error('Failed to update instructions')
      }
    } catch (err) {
      showErrorToast('Failed to update special instructions')
    }
  }

  const handleSavePriority = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${order.id}/priority`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority })
      })
      
      if (response.ok) {
        showSuccessToast('Order priority updated successfully')
        setIsEditingPriority(false)
        // Update the order object with new priority
        order.priority = priority
      } else {
        throw new Error('Failed to update priority')
      }
    } catch (err) {
      showErrorToast('Failed to update order priority')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${order.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          content: newComment,
          type: 'INTERNAL',
          author: 'Merchant' // In real app, this would be the logged-in user's name
        })
      })
      
      if (response.ok) {
        const commentData = await response.json()
        setComments([...comments, commentData])
        setNewComment('')
        setShowAddComment(false)
        showSuccessToast('Comment added successfully')
      } else {
        throw new Error('Failed to add comment')
      }
    } catch (err) {
      showErrorToast('Failed to add comment')
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/orders/${order.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId))
        showSuccessToast('Comment deleted successfully')
      } else {
        throw new Error('Failed to delete comment')
      }
    } catch (err) {
      showErrorToast('Failed to delete comment')
    }
  }

  const handleCallCustomer = () => {
    window.open(`tel:${order.customer?.phone}`)
  }

  const handleMessageCustomer = () => {
    // Open messaging app or in-app messaging
    window.open(`sms:${order.customer?.phone}`)
  }

  const getStatusTimeline = () => {
    const timeline = [
      { status: 'REQUESTED', timestamp: order.createdAt, completed: true },
      { status: 'ACCEPTED', timestamp: order.acceptedAt, completed: order.status !== 'REQUESTED' },
      { status: 'PROCESSING', timestamp: order.processingAt, completed: ['PROCESSING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'DELIVERED'].includes(order.status) },
      { status: 'READY_FOR_PICKUP', timestamp: order.readyAt, completed: ['READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'DELIVERED'].includes(order.status) },
      { status: 'RIDER_ASSIGNED', timestamp: order.riderAssignedAt, completed: ['RIDER_ASSIGNED', 'DELIVERED'].includes(order.status) },
      { status: 'DELIVERED', timestamp: order.deliveredAt, completed: order.status === 'DELIVERED' },
    ]
    return timeline
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
      case 'NORMAL': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getDeliveryEstimate = () => {
    if (order.status === 'DELIVERED') {
      return 'Delivered'
    } else if (order.status === 'RIDER_ASSIGNED') {
      return '15-25 minutes'
    } else if (order.status === 'READY_FOR_PICKUP') {
      return '20-30 minutes'
    } else if (order.status === 'PROCESSING') {
      return '25-35 minutes'
    } else {
      return '30-45 minutes'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                Order #{order.id.slice(0, 8)}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                Placed on {format(new Date(order.createdAt), 'MMM dd, yyyy at h:mm a')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 -mr-1 shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Customer Information */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {order.customer?.firstName} {order.customer?.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {order.customer?.phone}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {order.customer?.email}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Actions</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCallCustomer}
                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    title="Call Customer"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleMessageCustomer}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Message Customer"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Order Status and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Order Status
              </h3>
              <div className="space-y-3">
                {getStatusTimeline().map((item, index) => (
                  <div key={item.status} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.completed 
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                    }`}>
                      {item.completed ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        item.completed 
                          ? 'text-gray-900 dark:text-gray-100' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </p>
                      {item.timestamp && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(item.timestamp), 'MMM dd, h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Order Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Priority</span>
                  {isEditingPriority ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 rounded text-sm"
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                      <button
                        onClick={handleSavePriority}
                        className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditingPriority(false)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}>
                        {priority}
                      </span>
                      <button
                        onClick={() => setIsEditingPriority(true)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Delivery Estimate</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {getDeliveryEstimate()}
                  </span>
                </div>
                {order.rider && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Assigned Rider</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {order.rider.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Amount</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    ₦{order.total?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Pickup Location
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {order.pickupLocation?.address || 'Your business location'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Location
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {order.deliveryLocation?.address || 'Customer address'}
              </p>
            </div>
          </div>

          {/* Phase 5 — Proof of Delivery card. Renders after the rider hits
              DELIVERED. Shows the doorstep photo + optional signature so the
              merchant can verify the order was completed correctly. */}
          {(order.podPhotoUrl || order.podSignatureUrl) && ['DELIVERED', 'SETTLED'].includes(order.status) ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Proof of delivery</p>
                {order.podCapturedAt ? (
                  <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-400">
                    {format(new Date(order.podCapturedAt), 'd MMM yyyy, HH:mm')}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {order.podPhotoUrl ? (
                  <a
                    href={order.podPhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900">
                      <img
                        src={order.podPhotoUrl}
                        alt="Doorstep photo"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">Doorstep photo — tap to view</p>
                  </a>
                ) : null}
                {order.podSignatureUrl ? (
                  <a
                    href={order.podSignatureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 flex items-center justify-center">
                      <img
                        src={order.podSignatureUrl}
                        alt="Recipient signature"
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">Recipient signature</p>
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Phase 8 — prescription attachment card. Only renders for pharmacy
              orders where the customer uploaded a prescription at checkout. */}
          {order.prescriptionUrl ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
              <div className="text-amber-700 dark:text-amber-400 text-2xl leading-none">℞</div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Prescription attached</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Verify against the items below before accepting.
                </p>
                <a
                  href={order.prescriptionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200 underline"
                >
                  Open prescription image
                </a>
              </div>
            </div>
          ) : null}

          {/* Order Items */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Order Items
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => {
                    // Phase 2 line shape: unitPrice, lineTotal, selectedOptions, specialInstructions.
                    // Phase 8 adds: substitution, plus product.requiresPrescription / dosage.
                    const lineUnit = item.unitPrice != null ? Number(item.unitPrice) : Number(item.price || 0)
                    const lineTotal = item.lineTotal != null
                      ? Number(item.lineTotal)
                      : lineUnit * Number(item.quantity || 0)
                    const groups = Array.isArray(item.selectedOptions) ? item.selectedOptions : []
                    const sub = item.substitution
                    const subText = sub === 'MERCHANT_PICK'
                      ? 'Substitutes OK'
                      : sub === 'CONTACT_ME'
                        ? 'Call before swapping'
                        : sub === 'NONE'
                          ? 'No substitutes'
                          : null
                    return (
                      <tr key={item.id || index} className="border-b border-gray-200 dark:border-gray-700 align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {item.name}
                          </p>
                          {groups.length > 0 && (
                            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                              {groups.map((g) => (
                                <li key={g.groupId}>
                                  <span className="font-semibold">{g.groupName}:</span>{' '}
                                  {(g.items || []).map((i) => i.itemName).join(', ')}
                                </li>
                              ))}
                            </ul>
                          )}
                          {item.specialInstructions ? (
                            <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                              “{item.specialInstructions}”
                            </p>
                          ) : null}
                          {/* Phase 8 — grocery substitution chip on the kitchen ticket. */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {subText && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                ⇄ {subText}
                              </span>
                            )}
                            {item.product?.requiresPrescription || item.requiresPrescription ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                ℞ Rx required
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right">
                          ₦{lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan="2" className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      ₦{order.total?.toLocaleString() || '0'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Special Instructions
            </h3>
            {isEditingInstructions ? (
              <div className="space-y-3">
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  placeholder="Add special instructions for this order..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveInstructions}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingInstructions(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <p className="text-gray-700 dark:text-gray-300">
                    {specialInstructions || 'No special instructions'}
                  </p>
                  <button
                    onClick={() => setIsEditingInstructions(true)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Notes */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Order Notes
            </h3>
            {isEditingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={3}
                  placeholder="Add internal notes about this order..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <p className="text-gray-700 dark:text-gray-300">
                    {orderNotes || 'No notes added'}
                  </p>
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Comments & History
              </h3>
              <button
                onClick={() => setShowAddComment(!showAddComment)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Comment
              </button>
            </div>

            {/* Add Comment Form */}
            {showAddComment && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-100"
                  rows={3}
                  placeholder="Add a comment..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddComment}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Post Comment
                  </button>
                  <button
                    onClick={() => {
                      setShowAddComment(false)
                      setNewComment('')
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No comments yet</p>
                  <p className="text-sm">Add a comment to track order updates</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {comment.author}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(comment.createdAt), 'MMM dd, yyyy at HH:mm')}
                            </p>
                          </div>
                          {comment.type && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              comment.type === 'INTERNAL' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {comment.type}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                          {comment.content}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete comment"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
