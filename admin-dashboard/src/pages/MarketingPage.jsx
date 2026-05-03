import { useState, useEffect } from 'react'
import { Megaphone, Check, X, RefreshCw, Tag } from 'lucide-react'

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [loading, setLoading] = useState(true)
  const [campaigns, setCampaigns] = useState([])
  const [discounts, setDiscounts] = useState([])
  const [discountFilter, setDiscountFilter] = useState('ALL')

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/marketing/campaigns', {
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
      const response = await fetch(`/api/admin/marketing/discounts?status=${status}`, {
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
      await fetch(`/api/admin/marketing/discounts/${discountId}/approve`, {
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
      await fetch(`/api/admin/marketing/discounts/${discountId}/reject`, {
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

  useEffect(() => {
    if (activeTab === 'campaigns') fetchCampaigns()
    else fetchDiscounts()
  }, [activeTab, discountFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Marketing Oversight</h1>
        <button onClick={activeTab === 'campaigns' ? fetchCampaigns : fetchDiscounts} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'campaigns' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Megaphone className="w-4 h-4 inline mr-2" />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'discounts' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Tag className="w-4 h-4 inline mr-2" />
          Discount Codes
        </button>
      </div>

      {activeTab === 'campaigns' ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full">
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
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
              <button
                key={status}
                onClick={() => setDiscountFilter(status)}
                className={`px-3 py-1 rounded text-sm ${discountFilter === status ? 'bg-primary text-white' : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'}`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <table className="w-full">
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
                      <td className="px-4 py-3">{discount.discountPercentage || discount.discountAmount}%</td>
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
                        {discount.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveDiscount(discount.id)} className="p-1 text-success hover:bg-success/10 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleRejectDiscount(discount.id)} className="p-1 text-error hover:bg-error/10 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
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
      )}
    </div>
  )
}
