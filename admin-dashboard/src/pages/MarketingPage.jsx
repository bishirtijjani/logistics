import { useState, useEffect } from 'react'
import { API_URL } from '../lib/api'
import { Megaphone, Check, X, RefreshCw, Tag, Image as ImageIcon, Trash2, Edit, Plus } from 'lucide-react'
import ActionMenu from '../components/ActionMenu'

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [discountFilter, setDiscountFilter] = useState('ALL')
  const [banners, setBanners] = useState([])
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState(null)
  const [newBanner, setNewBanner] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    deepLink: '',
    bgColor: '',
    priority: 0,
    isActive: true
  })

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/admin/marketing/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setCampaigns(data.data.campaigns || [])
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDiscounts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const status = discountFilter === 'ALL' ? '' : discountFilter
      const response = await fetch(`${API_URL}/admin/marketing/discounts?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setDiscounts(data.data.discounts || [])
    } catch (error) {
      console.error('Failed to fetch discounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveDiscount = async (discountId) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/admin/marketing/discounts/${discountId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchDiscounts()
    } catch (error) {
      console.error('Failed to approve discount:', error)
    }
  }

  const handleRejectDiscount = async (discountId) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return
    
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/admin/marketing/discounts/${discountId}/reject`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })
      fetchDiscounts()
    } catch (error) {
      console.error('Failed to reject discount:', error)
    }
  }

  const fetchBanners = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/admin/marketing/banners`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setBanners(data.data || [])
    } catch (error) {
      console.error('Failed to fetch banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBanner = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const method = editingBanner ? 'PUT' : 'POST'
      const url = editingBanner 
        ? `${API_URL}/admin/marketing/banners/${editingBanner.id}`
        : `${API_URL}/admin/marketing/banners`
      
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newBanner,
          priority: parseInt(newBanner.priority, 10) || 0
        })
      })
      const data = await response.json()
      if (data.success) {
        fetchBanners()
        setShowBannerModal(false)
        setEditingBanner(null)
        setNewBanner({ title: '', subtitle: '', imageUrl: '', deepLink: '', bgColor: '', priority: 0, isActive: true })
      }
    } catch (error) {
      console.error('Failed to save banner:', error)
    }
  }

  const handleDeleteBanner = async (bannerId) => {
    if (!confirm('Are you sure you want to delete this banner?')) return
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/admin/marketing/banners/${bannerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchBanners()
    } catch (error) {
      console.error('Failed to delete banner:', error)
    }
  }

  useEffect(() => {
    if (activeTab === 'campaigns') fetchCampaigns()
    else if (activeTab === 'discounts') fetchDiscounts()
    else fetchBanners()
  }, [activeTab, discountFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Marketing Oversight</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'banners' && (
            <button
              onClick={() => {
                setEditingBanner(null)
                setNewBanner({ title: '', subtitle: '', imageUrl: '', deepLink: '', bgColor: '', priority: 0, isActive: true })
                setShowBannerModal(true)
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg flex items-center justify-center text-sm gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add Banner
            </button>
          )}
          <button onClick={activeTab === 'campaigns' ? fetchCampaigns : activeTab === 'discounts' ? fetchDiscounts : fetchBanners} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-4 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-3 sm:px-4 py-3 border-b-2 text-sm whitespace-nowrap ${activeTab === 'campaigns' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Megaphone className="w-4 h-4 inline mr-2" />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`px-3 sm:px-4 py-3 border-b-2 text-sm whitespace-nowrap ${activeTab === 'discounts' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Tag className="w-4 h-4 inline mr-2" />
          Discount Codes
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-3 sm:px-4 py-3 border-b-2 text-sm whitespace-nowrap ${activeTab === 'banners' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <ImageIcon className="w-4 h-4 inline mr-2" />
          Home Banners
        </button>
      </div>

      {activeTab === 'campaigns' ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Budget</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b">
                    <td className="px-4 py-3">{campaign.name}</td>
                    <td className="px-4 py-3">₦{campaign.budget || 0}</td>
                    <td className="px-4 py-3">{campaign.status}</td>
                    <td className="px-4 py-3">{new Date(campaign.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No campaigns found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === 'discounts' ? (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setDiscountFilter(status)}
                className={`px-3 py-1 rounded text-sm whitespace-nowrap ${discountFilter === status ? 'bg-primary text-white' : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'}`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <table className="w-full min-w-[640px]">
                <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Merchant</th>
                    <th className="px-4 py-3 text-left">Discount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((discount) => (
                    <tr key={discount.id} className="border-b">
                      <td className="px-4 py-3 font-mono">{discount.code}</td>
                      <td className="px-4 py-3">{discount.merchant?.name || 'Platform'}</td>
                      <td className="px-4 py-3">{discount.type === 'percentage' ? `${discount.value}%` : `₦${discount.value}`}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          discount.status === 'APPROVED' ? 'bg-success/10 text-success' :
                          discount.status === 'REJECTED' ? 'bg-error/10 text-error' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {discount.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          align="left"
                          actions={[
                            {
                              label: 'Approve',
                              icon: Check,
                              hidden: discount.status !== 'PENDING',
                              onClick: () => handleApproveDiscount(discount.id),
                            },
                            {
                              label: 'Reject',
                              icon: X,
                              danger: true,
                              hidden: discount.status !== 'PENDING',
                              onClick: () => handleRejectDiscount(discount.id),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                  {discounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No discount codes found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Banner</th>
                  <th className="px-4 py-3 text-left">Deep Link</th>
                  <th className="px-4 py-3 text-left">Priority</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => (
                  <tr key={banner.id} className="border-b">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={banner.imageUrl} alt={banner.title} className="w-16 h-10 object-cover rounded border" />
                        <div>
                          <div className="font-semibold text-text dark:text-dark-text">{banner.title}</div>
                          {banner.subtitle && <div className="text-xs text-muted dark:text-dark-muted">{banner.subtitle}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{banner.deepLink || '-'}</td>
                    <td className="px-4 py-3">{banner.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${banner.isActive ? 'bg-success/10 text-success' : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'}`}>
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        align="left"
                        actions={[
                          {
                            label: 'Edit',
                            icon: Edit,
                            onClick: () => {
                              setEditingBanner(banner)
                              setNewBanner({
                                title: banner.title,
                                subtitle: banner.subtitle || '',
                                imageUrl: banner.imageUrl,
                                deepLink: banner.deepLink || '',
                                bgColor: banner.bgColor || '',
                                priority: banner.priority,
                                isActive: banner.isActive
                              })
                              setShowBannerModal(true)
                            },
                          },
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => handleDeleteBanner(banner.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No home banners configured</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Banner Creation/Editing Modal */}
      {showBannerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg p-4 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-surface-muted dark:border-dark-surface-muted pb-2">
              <h3 className="font-bold text-lg text-text dark:text-dark-text">{editingBanner ? 'Edit Banner' : 'Create Home Banner'}</h3>
              <button onClick={() => setShowBannerModal(false)} className="text-muted dark:text-dark-muted hover:text-text"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveBanner} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Banner Title</label>
                <input
                  type="text"
                  required
                  value={newBanner.title}
                  onChange={e => setNewBanner({ ...newBanner, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Subtitle (Optional)</label>
                <input
                  type="text"
                  value={newBanner.subtitle}
                  onChange={e => setNewBanner({ ...newBanner, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Image URL</label>
                <input
                  type="url"
                  required
                  value={newBanner.imageUrl}
                  onChange={e => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                  placeholder="https://cloudinary.com/... or similar"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Deep Link Route</label>
                  <input
                    type="text"
                    value={newBanner.deepLink}
                    onChange={e => setNewBanner({ ...newBanner, deepLink: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                    placeholder="/wallet, /utility/airtime"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Priority</label>
                  <input
                    type="number"
                    value={newBanner.priority}
                    onChange={e => setNewBanner({ ...newBanner, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text dark:text-dark-text">Background Color Accent (Optional)</label>
                <input
                  type="text"
                  value={newBanner.bgColor}
                  onChange={e => setNewBanner({ ...newBanner, bgColor: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-transparent text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted"
                  placeholder="#4F46E5"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newBanner.isActive}
                  onChange={e => setNewBanner({ ...newBanner, isActive: e.target.checked })}
                  className="rounded border-surface-muted dark:border-dark-surface-muted text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-medium select-none text-text dark:text-dark-text">Active (Visible to customers)</label>
              </div>
              <div className="flex justify-end gap-2 border-t border-surface-muted dark:border-dark-surface-muted pt-4">
                <button type="button" onClick={() => setShowBannerModal(false)} className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-sm text-text dark:text-dark-text">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">Save Banner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
