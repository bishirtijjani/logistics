import { useState, useEffect } from 'react'
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Calendar,
  MoreVertical,
  Edit,
  UserCheck,
  UserX,
  Lock,
  Plus,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import api from '../lib/api'
import { usePermissions } from '../lib/usePermissions'

const PERMISSIONS = [
  { id: 'ALL', label: 'Super Admin', description: 'Total access to all system features' },
  { id: 'MANAGE_USERS', label: 'Users', description: 'Manage Customers and Riders' },
  { id: 'MANAGE_MERCHANTS', label: 'Merchants', description: 'Manage Merchants, Categories, and Tags' },
  { id: 'MANAGE_FINANCE', label: 'Finance', description: 'Transactions, Revenue, and Payouts' },
  { id: 'MANAGE_SUPPORT', label: 'Support', description: 'Tickets, Disputes, and Safety incidents' },
  { id: 'MANAGE_SETTINGS', label: 'Settings', description: 'Platform settings, Marketing, and Banners' },
  { id: 'MANAGE_VTU', label: 'VTU', description: 'VTU plans and networks' },
  { id: 'MANAGE_STAFF', label: 'Staff', description: 'Create and manage other admin staff' },
]

export default function StaffManagementPage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const { isSuperAdmin } = usePermissions()

  // Only a super admin may grant full (ALL) access, mirroring the backend guard.
  const availablePermissions = isSuperAdmin()
    ? PERMISSIONS
    : PERMISSIONS.filter(p => p.id !== 'ALL')

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    status: 'ACTIVE',
    permissions: []
  })

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/staff')
      setStaff(response.data.data)
    } catch (error) {
      toast.error('Failed to fetch staff members')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePermission = (permId) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
      return { ...prev, permissions: perms }
    })
  }

  const handleCreateStaff = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/staff', formData)
      toast.success('Staff member created successfully')
      setShowCreateModal(false)
      fetchStaff()
      setFormData({ firstName: '', lastName: '', email: '', password: '', status: 'ACTIVE', permissions: [] })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create staff member')
    }
  }

  const handleUpdateStaff = async (e) => {
    e.preventDefault()
    try {
      await api.patch(`/admin/staff/${selectedStaff.id}/profile`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        status: formData.status,
      })
      await api.patch(`/admin/staff/${selectedStaff.id}/permissions`, {
        permissions: formData.permissions,
      })
      toast.success('Staff member updated successfully')
      setShowEditModal(false)
      fetchStaff()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update staff member')
    }
  }

  const handleEditClick = (member) => {
    setSelectedStaff(member)
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      status: member.status,
      // null permissions = super admin; reflect that as ALL in the editor.
      permissions: member.permissions || ['ALL']
    })
    setShowEditModal(true)
  }

  if (loading && staff.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text dark:text-dark-text">Staff Management</h2>
          <p className="text-muted dark:text-dark-muted text-sm">Create and manage administrative staff and their permissions.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <UserPlus size={18} />
          Add Staff Member
        </button>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-muted/50 dark:bg-dark-surface-muted/50">
                <th className="px-6 py-4 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider border-b border-surface-muted dark:border-dark-surface-muted">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider border-b border-surface-muted dark:border-dark-surface-muted">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider border-b border-surface-muted dark:border-dark-surface-muted">Permissions</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wider border-b border-surface-muted dark:border-dark-surface-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-surface-muted/20 dark:hover:bg-dark-surface-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text dark:text-dark-text">{member.firstName} {member.lastName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            member.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600'
                            : member.status === 'SUSPENDED' ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-red-500/10 text-red-600'
                          }`}>{member.status}</span>
                        </div>
                        <p className="text-xs text-muted dark:text-dark-muted">Added {new Date(member.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
                        <Mail size={14} className="text-muted" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
                        <Phone size={14} className="text-muted" />
                        {member.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {member.permissions?.includes('ALL') ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                          <ShieldCheck size={10} /> SUPER ADMIN
                        </span>
                      ) : (
                        member.permissions?.map(p => (
                          <span key={p} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text border border-surface-muted dark:border-dark-surface-muted">
                            {p.replace('MANAGE_', '')}
                          </span>
                        ))
                      )}
                      {(!member.permissions || member.permissions.length === 0) && (
                        <span className="text-xs text-muted italic">No specific permissions</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleEditClick(member)}
                      className="p-2 text-muted hover:text-primary transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-surface-muted dark:border-dark-surface-muted overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex items-center justify-between shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Add New Staff Member</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-text dark:hover:text-dark-text">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">First Name</label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">Last Name</label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text dark:text-dark-text">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text dark:text-dark-text">Temporary Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-text dark:text-dark-text">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availablePermissions.map(perm => (
                    <div 
                      key={perm.id}
                      onClick={() => handleTogglePermission(perm.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        formData.permissions.includes(perm.id)
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'bg-background dark:bg-dark-background border-surface-muted dark:border-dark-surface-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs uppercase tracking-wide text-text dark:text-dark-text">{perm.label}</span>
                        {formData.permissions.includes(perm.id) && <ShieldCheck size={16} className="text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted dark:text-dark-muted leading-tight">{perm.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors shadow-sm"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-surface-muted dark:border-dark-surface-muted overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-surface-muted dark:border-dark-surface-muted flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-text dark:text-dark-text">Edit Staff Permissions</h3>
                <p className="text-xs text-muted">{selectedStaff?.firstName} {selectedStaff?.lastName} ({selectedStaff?.email})</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted hover:text-text dark:hover:text-dark-text">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateStaff} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text dark:text-dark-text">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-background dark:bg-dark-background text-text dark:text-dark-text focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-text dark:text-dark-text">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availablePermissions.map(perm => (
                    <div 
                      key={perm.id}
                      onClick={() => handleTogglePermission(perm.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        formData.permissions.includes(perm.id)
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'bg-background dark:bg-dark-background border-surface-muted dark:border-dark-surface-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs uppercase tracking-wide text-text dark:text-dark-text">{perm.label}</span>
                        {formData.permissions.includes(perm.id) && <ShieldCheck size={16} className="text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted dark:text-dark-muted leading-tight">{perm.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors shadow-sm"
                >
                  Update Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
