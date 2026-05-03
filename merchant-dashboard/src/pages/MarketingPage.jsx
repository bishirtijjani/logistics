import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'
import {
  Megaphone,
  Tag,
  Users,
  Mail,
  Plus,
  Edit,
  Trash2,
  Copy,
  TrendingUp,
  Calendar,
  Target,
  Gift,
  Percent,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Eye,
  Star,
} from 'lucide-react'

export default function MarketingPage() {
  const { merchantId } = useParams()
  const [activeTab, setActiveTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState([])
  const [discountCodes, setDiscountCodes] = useState([])
  const [loyaltyProgram, setLoyaltyProgram] = useState(null)
  const [emailCampaigns, setEmailCampaigns] = useState([])
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Form states
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'promotion',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
    targetAudience: 'all',
    status: 'draft'
  })

  const [newDiscount, setNewDiscount] = useState({
    code: '',
    type: 'percentage',
    value: '',
    minOrder: '',
    maxDiscount: '',
    usageLimit: '',
    startDate: '',
    endDate: '',
    status: 'active'
  })

  const [newLoyalty, setNewLoyalty] = useState({
    name: '',
    pointsPerNaira: 1,
    redemptionRate: 100,
    welcomeBonus: 0,
    tiers: [
      { name: 'Bronze', minPoints: 0, benefits: '5% off on birthdays' },
      { name: 'Silver', minPoints: 500, benefits: '10% off + free delivery' },
      { name: 'Gold', minPoints: 1000, benefits: '15% off + priority support' }
    ]
  })

  const [newEmail, setNewEmail] = useState({
    subject: '',
    template: 'promotion',
    content: '',
    recipientList: 'all',
    scheduledDate: '',
    status: 'draft'
  })

  // Mock data - in production, these would come from API
  const mockCampaigns = [
    {
      id: 1,
      name: 'Ramadan Special',
      type: 'promotion',
      description: 'Special discounts for Ramadan season',
      status: 'active',
      startDate: '2024-03-10',
      endDate: '2024-04-10',
      budget: 50000,
      spent: 32000,
      targetAudience: 'all',
      performance: { impressions: 15000, clicks: 1200, conversions: 180, roi: 2.5 }
    },
    {
      id: 2,
      name: 'Weekend Rush',
      type: 'promotion',
      description: 'Boost weekend orders with special offers',
      status: 'completed',
      startDate: '2024-02-01',
      endDate: '2024-02-29',
      budget: 30000,
      spent: 28000,
      targetAudience: 'repeat',
      performance: { impressions: 8000, clicks: 800, conversions: 120, roi: 3.2 }
    },
    {
      id: 3,
      name: 'New Product Launch',
      type: 'announcement',
      description: 'Launch our new healthy menu items',
      status: 'draft',
      startDate: '2024-04-15',
      endDate: '2024-05-15',
      budget: 25000,
      spent: 0,
      targetAudience: 'all',
      performance: { impressions: 0, clicks: 0, conversions: 0, roi: 0 }
    }
  ]

  const mockDiscountCodes = [
    {
      id: 1,
      code: 'RAMADAN20',
      type: 'percentage',
      value: 20,
      minOrder: 2000,
      maxDiscount: 1000,
      usageLimit: 500,
      used: 234,
      startDate: '2024-03-10',
      endDate: '2024-04-10',
      status: 'active',
      revenue: 468000
    },
    {
      id: 2,
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minOrder: 1000,
      maxDiscount: 500,
      usageLimit: 1000,
      used: 567,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'active',
      revenue: 234000
    },
    {
      id: 3,
      code: 'WEEKEND500',
      type: 'fixed',
      value: 500,
      minOrder: 3000,
      maxDiscount: null,
      usageLimit: 200,
      used: 89,
      startDate: '2024-02-01',
      endDate: '2024-02-29',
      status: 'expired',
      revenue: 156000
    }
  ]

  const mockLoyaltyProgram = {
    id: 1,
    name: 'VTU Rewards',
    pointsPerNaira: 1,
    redemptionRate: 100,
    welcomeBonus: 50,
    activeMembers: 1250,
    totalPointsIssued: 125000,
    totalPointsRedeemed: 45000,
    tiers: [
      { name: 'Bronze', minPoints: 0, members: 800, benefits: '5% off on birthdays' },
      { name: 'Silver', minPoints: 500, members: 350, benefits: '10% off + free delivery' },
      { name: 'Gold', minPoints: 1000, members: 100, benefits: '15% off + priority support' }
    ]
  }

  const mockEmailCampaigns = [
    {
      id: 1,
      subject: 'Ramadan Special Offers Inside!',
      template: 'promotion',
      recipientList: 'all',
      sentDate: '2024-03-10',
      status: 'sent',
      performance: { sent: 5000, delivered: 4850, opened: 1940, clicked: 290, converted: 58 }
    },
    {
      id: 2,
      subject: 'New Healthy Menu Items',
      template: 'announcement',
      recipientList: 'health_conscious',
      scheduledDate: '2024-04-15',
      status: 'scheduled',
      performance: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 }
    }
  ]

  useEffect(() => {
    setCampaigns(mockCampaigns)
    setDiscountCodes(mockDiscountCodes)
    setLoyaltyProgram(mockLoyaltyProgram)
    setEmailCampaigns(mockEmailCampaigns)
  }, [])

  const createCampaign = () => {
    if (newCampaign.name && newCampaign.description) {
      const campaign = {
        id: campaigns.length + 1,
        ...newCampaign,
        spent: 0,
        performance: { impressions: 0, clicks: 0, conversions: 0, roi: 0 }
      }
      setCampaigns([campaign, ...campaigns])
      setShowCampaignModal(false)
      setNewCampaign({
        name: '',
        type: 'promotion',
        description: '',
        startDate: '',
        endDate: '',
        budget: '',
        targetAudience: 'all',
        status: 'draft'
      })
      showSuccessToast('Campaign created successfully')
    }
  }

  const createDiscountCode = () => {
    if (newDiscount.code && newDiscount.value) {
      const discount = {
        id: discountCodes.length + 1,
        ...newDiscount,
        used: 0,
        revenue: 0
      }
      setDiscountCodes([discount, ...discountCodes])
      setShowDiscountModal(false)
      setNewDiscount({
        code: '',
        type: 'percentage',
        value: '',
        minOrder: '',
        maxDiscount: '',
        usageLimit: '',
        startDate: '',
        endDate: '',
        status: 'active'
      })
      showSuccessToast('Discount code created successfully')
    }
  }

  const updateLoyaltyProgram = () => {
    if (newLoyalty.name) {
      setLoyaltyProgram({
        ...mockLoyaltyProgram,
        ...newLoyalty,
        activeMembers: mockLoyaltyProgram.activeMembers,
        totalPointsIssued: mockLoyaltyProgram.totalPointsIssued,
        totalPointsRedeemed: mockLoyaltyProgram.totalPointsRedeemed
      })
      setShowLoyaltyModal(false)
      showSuccessToast('Loyalty program updated successfully')
    }
  }

  const createEmailCampaign = () => {
    if (newEmail.subject && newEmail.content) {
      const email = {
        id: emailCampaigns.length + 1,
        ...newEmail,
        sentDate: newEmail.status === 'sent' ? new Date().toISOString().split('T')[0] : null,
        performance: { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 }
      }
      setEmailCampaigns([email, ...emailCampaigns])
      setShowEmailModal(false)
      setNewEmail({
        subject: '',
        template: 'promotion',
        content: '',
        recipientList: 'all',
        scheduledDate: '',
        status: 'draft'
      })
      showSuccessToast('Email campaign created successfully')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'draft': return 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'sent': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'scheduled': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    showSuccessToast('Copied to clipboard')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Marketing Tools</h1>
        <p className="text-muted dark:text-dark-muted">Manage campaigns, discounts, and customer engagement</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm mb-6">
        <div className="border-b border-surface-muted dark:border-dark-surface-muted">
          <div className="flex space-x-8 px-6">
            {['campaigns', 'discounts', 'loyalty', 'email'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary dark:text-primary'
                    : 'border-transparent text-muted hover:text-text dark:text-dark-muted dark:hover:text-dark-text'
                }`}
              >
                {tab === 'discounts' ? 'Discount Codes' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">Promotional Campaigns</h2>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-text dark:text-dark-text mb-2">{campaign.name}</h3>
                <p className="text-sm text-muted dark:text-dark-muted mb-4">{campaign.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted dark:text-dark-muted">Budget</span>
                    <span className="font-medium">₦{campaign.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted dark:text-dark-muted">Spent</span>
                    <span className="font-medium">₦{campaign.spent.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-surface-muted dark:bg-dark-surface-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted dark:text-dark-muted">Impressions</p>
                    <p className="font-medium">{campaign.performance.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted dark:text-dark-muted">Conversions</p>
                    <p className="font-medium">{campaign.performance.conversions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discount Codes Tab */}
      {activeTab === 'discounts' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">Discount Codes</h2>
            <button
              onClick={() => setShowDiscountModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Discount
            </button>
          </div>

          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
                  {discountCodes.map((discount) => (
                    <tr key={discount.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text dark:text-dark-text">{discount.code}</span>
                          <button
                            onClick={() => copyToClipboard(discount.code)}
                            className="text-muted hover:text-text dark:hover:text-dark-text"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-text dark:text-dark-text capitalize">{discount.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-text dark:text-dark-text">
                          {discount.type === 'percentage' ? `${discount.value}%` : `₦${discount.value}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-text dark:text-dark-text">
                          {discount.used} / {discount.usageLimit}
                        </div>
                        <div className="w-full bg-surface-muted dark:bg-dark-surface-muted rounded-full h-1 mt-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full" 
                            style={{ width: `${(discount.used / discount.usageLimit) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(discount.status)}`}>
                          {discount.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text dark:text-dark-text">
                        ₦{discount.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            Edit
                          </button>
                          <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Program Tab */}
      {activeTab === 'loyalty' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">Loyalty Program</h2>
            <button
              onClick={() => setShowLoyaltyModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Configure
            </button>
          </div>

          {loyaltyProgram && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Program Overview */}
                <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-4">{loyaltyProgram.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Active Members</p>
                      <p className="text-2xl font-bold text-text dark:text-dark-text">{loyaltyProgram.activeMembers.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Points Issued</p>
                      <p className="text-2xl font-bold text-blue-600">{loyaltyProgram.totalPointsIssued.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Points Redeemed</p>
                      <p className="text-2xl font-bold text-green-600">{loyaltyProgram.totalPointsRedeemed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted dark:text-dark-muted">Redemption Rate</p>
                      <p className="text-2xl font-bold text-purple-600">{loyaltyProgram.redemptionRate} pts</p>
                    </div>
                  </div>
                </div>

                {/* Loyalty Tiers */}
                <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-text dark:text-dark-text mb-4">Membership Tiers</h3>
                  <div className="space-y-4">
                    {loyaltyProgram.tiers.map((tier, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-amber-100 dark:bg-amber-900/30' :
                            index === 1 ? 'bg-gray-100 dark:bg-gray-900/30' :
                            'bg-yellow-100 dark:bg-yellow-900/30'
                          }`}>
                            <Star className={`w-6 h-6 ${
                              index === 0 ? 'text-amber-600 dark:text-amber-400' :
                              index === 1 ? 'text-gray-600 dark:text-gray-400' :
                              'text-yellow-600 dark:text-yellow-400'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-medium text-text dark:text-dark-text">{tier.name}</h4>
                            <p className="text-sm text-muted dark:text-dark-muted">{tier.benefits}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted dark:text-dark-muted">{tier.members} members</p>
                          <p className="text-sm font-medium text-text dark:text-dark-text">{tier.minPoints}+ pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-text dark:text-dark-text mb-4">Program Settings</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">Points per ₦1</p>
                    <p className="text-lg font-medium text-text dark:text-dark-text">{loyaltyProgram.pointsPerNaira} point</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">Redemption Rate</p>
                    <p className="text-lg font-medium text-text dark:text-dark-text">₦{loyaltyProgram.redemptionRate} = 100 pts</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted dark:text-dark-muted">Welcome Bonus</p>
                    <p className="text-lg font-medium text-text dark:text-dark-text">{loyaltyProgram.welcomeBonus} points</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Marketing Tab */}
      {activeTab === 'email' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">Email Marketing</h2>
            <button
              onClick={() => setShowEmailModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {emailCampaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-text dark:text-dark-text mb-2">{campaign.subject}</h3>
                <p className="text-sm text-muted dark:text-dark-muted mb-4 capitalize">{campaign.template} template</p>
                
                {campaign.status === 'sent' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted dark:text-dark-muted">Sent</span>
                      <span className="font-medium">{campaign.performance.sent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted dark:text-dark-muted">Opened</span>
                      <span className="font-medium">{campaign.performance.opened.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted dark:text-dark-muted">Clicked</span>
                      <span className="font-medium">{campaign.performance.clicked.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted dark:text-dark-muted">Converted</span>
                      <span className="font-medium">{campaign.performance.converted}</span>
                    </div>
                  </div>
                )}

                {campaign.status === 'scheduled' && (
                  <div className="text-sm text-muted dark:text-dark-muted">
                    Scheduled for {campaign.scheduledDate}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <h2 className="text-xl font-bold text-text dark:text-dark-text">Create Campaign</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Type
                </label>
                <select
                  value={newCampaign.type}
                  onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="promotion">Promotion</option>
                  <option value="announcement">Announcement</option>
                  <option value="survey">Survey</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Description
                </label>
                <textarea
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newCampaign.endDate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Budget (₦)
                </label>
                <input
                  type="number"
                  value={newCampaign.budget}
                  onChange={(e) => setNewCampaign({ ...newCampaign, budget: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted flex gap-3 justify-end">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={createCampaign}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Code Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <h2 className="text-xl font-bold text-text dark:text-dark-text">Create Discount Code</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Code
                </label>
                <input
                  type="text"
                  value={newDiscount.code}
                  onChange={(e) => setNewDiscount({ ...newDiscount, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  placeholder="e.g., SAVE20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Type
                  </label>
                  <select
                    value={newDiscount.type}
                    onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Value
                  </label>
                  <input
                    type="number"
                    value={newDiscount.value}
                    onChange={(e) => setNewDiscount({ ...newDiscount, value: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    placeholder={newDiscount.type === 'percentage' ? '20' : '500'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Min Order (₦)
                  </label>
                  <input
                    type="number"
                    value={newDiscount.minOrder}
                    onChange={(e) => setNewDiscount({ ...newDiscount, minOrder: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    value={newDiscount.usageLimit}
                    onChange={(e) => setNewDiscount({ ...newDiscount, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newDiscount.startDate}
                    onChange={(e) => setNewDiscount({ ...newDiscount, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newDiscount.endDate}
                    onChange={(e) => setNewDiscount({ ...newDiscount, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted flex gap-3 justify-end">
              <button
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={createDiscountCode}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Program Modal */}
      {showLoyaltyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <h2 className="text-xl font-bold text-text dark:text-dark-text">Configure Loyalty Program</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Program Name
                </label>
                <input
                  type="text"
                  value={newLoyalty.name}
                  onChange={(e) => setNewLoyalty({ ...newLoyalty, name: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Points per ₦1
                  </label>
                  <input
                    type="number"
                    value={newLoyalty.pointsPerNaira}
                    onChange={(e) => setNewLoyalty({ ...newLoyalty, pointsPerNaira: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                    Redemption Rate (₦)
                  </label>
                  <input
                    type="number"
                    value={newLoyalty.redemptionRate}
                    onChange={(e) => setNewLoyalty({ ...newLoyalty, redemptionRate: e.target.value })}
                    className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Welcome Bonus (points)
                </label>
                <input
                  type="number"
                  value={newLoyalty.welcomeBonus}
                  onChange={(e) => setNewLoyalty({ ...newLoyalty, welcomeBonus: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted flex gap-3 justify-end">
              <button
                onClick={() => setShowLoyaltyModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={updateLoyaltyProgram}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Campaign Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-surface-muted dark:border-dark-surface-muted">
              <h2 className="text-xl font-bold text-text dark:text-dark-text">Create Email Campaign</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={newEmail.subject}
                  onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Template
                </label>
                <select
                  value={newEmail.template}
                  onChange={(e) => setNewEmail({ ...newEmail, template: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="promotion">Promotion</option>
                  <option value="announcement">Announcement</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="survey">Survey</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Content
                </label>
                <textarea
                  value={newEmail.content}
                  onChange={(e) => setNewEmail({ ...newEmail, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Recipient List
                </label>
                <select
                  value={newEmail.recipientList}
                  onChange={(e) => setNewEmail({ ...newEmail, recipientList: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="all">All Customers</option>
                  <option value="active">Active Customers</option>
                  <option value="inactive">Inactive Customers</option>
                  <option value="vip">VIP Customers</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                  Scheduled Date
                </label>
                <input
                  type="datetime-local"
                  value={newEmail.scheduledDate}
                  onChange={(e) => setNewEmail({ ...newEmail, scheduledDate: e.target.value })}
                  className="w-full px-3 py-2 border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-surface-muted dark:border-dark-surface-muted flex gap-3 justify-end">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createEmailCampaign()
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
