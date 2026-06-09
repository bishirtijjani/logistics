import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RefreshCw, Download, Inbox, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import Pagination from '../components/Pagination'
import api from '../lib/api'
import { exportToCSV } from '../lib/exportToCSV'
import {
  fetchWaitlist,
  fetchWaitlistSummary,
  deleteWaitlistEntry,
} from '../store/slices/waitlistSlice'

const ROLE_TABS = [
  { value: '', label: 'All' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'RIDER', label: 'Riders' },
  { value: 'UNKNOWN', label: 'Unspecified' },
]

const PLATFORMS = ['', 'IOS', 'ANDROID', 'UNKNOWN']

const roleBadge = (role) => {
  switch (role) {
    case 'CUSTOMER':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'RIDER':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

const platformBadge = (platform) => {
  switch (platform) {
    case 'IOS':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    case 'ANDROID':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    default:
      return 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

export default function WaitlistPage() {
  const dispatch = useDispatch()
  const { entries, total, loading, error, summary } = useSelector((s) => s.waitlist)

  const [role, setRole] = useState('')
  const [platform, setPlatform] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Debounce search to avoid hammering the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setCurrentPage(1)
  }, [role, platform, debouncedSearch])

  const load = () => {
    dispatch(
      fetchWaitlist({
        role: role || undefined,
        platform: platform || undefined,
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: pageSize,
      }),
    )
    dispatch(fetchWaitlistSummary())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, platform, debouncedSearch, currentPage, pageSize])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove ${entry.name} (${entry.phone}) from the waitlist?`)) return
    try {
      await dispatch(deleteWaitlistEntry(entry.id)).unwrap()
      toast.success('Entry removed')
    } catch (err) {
      toast.error(err.message || 'Failed to remove entry')
    }
  }

  // Pull every entry that matches the current filters (up to 1000) so the
  // export reflects the filter - not just the visible page.
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        page: 1,
        limit: 1000,
        ...(role && { role }),
        ...(platform && { platform }),
        ...(debouncedSearch && { search: debouncedSearch }),
      })
      const res = await api.get(`/admin/waitlist?${params}`)
      const rows = (res.data?.data || []).map((e) => ({
        name: e.name,
        phone: e.phone,
        email: e.email || '',
        city: e.city || '',
        role: e.role,
        platform: e.platform,
        source: e.source || '',
        notes: e.notes || '',
        createdAt: new Date(e.createdAt).toISOString(),
      }))
      if (rows.length === 0) {
        toast.message('Nothing to export with the current filters.')
        return
      }
      exportToCSV(rows, `waitlist-${new Date().toISOString().slice(0, 10)}`, [
        'name',
        'phone',
        'email',
        'city',
        'role',
        'platform',
        'source',
        'notes',
        'createdAt',
      ])
      toast.success(`Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Pre-launch Waitlist</h1>
          <p className="text-sm text-muted dark:text-dark-muted">
            Visitors who tapped a Download button on the marketing site before the apps went live.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={load}
            className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg flex items-center justify-center gap-2 hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
          >
            <RefreshCw className="w-4 h-4" /> <span className="text-sm">Refresh</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="p-2 border border-primary text-primary rounded-lg flex items-center justify-center gap-2 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> <span className="text-sm">{exporting ? 'Exporting…' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Customers" value={summary.roleCounts?.CUSTOMER || 0} />
        <SummaryCard label="Riders" value={summary.roleCounts?.RIDER || 0} />
        <SummaryCard label="iOS" value={summary.platformCounts?.IOS || 0} />
        <SummaryCard label="Android" value={summary.platformCounts?.ANDROID || 0} />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex gap-1 sm:gap-3 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto flex-1">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              onClick={() => setRole(tab.value)}
              className={`px-3 sm:px-4 py-3 border-b-2 text-sm whitespace-nowrap transition-colors ${
                role === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            {PLATFORMS.map((p) => (
              <option key={p || 'all'} value={p}>
                {p ? p : 'All platforms'}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted dark:text-dark-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, email, city…"
              className="pl-9 pr-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none w-56"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted py-12 flex flex-col items-center gap-3 text-muted dark:text-dark-muted">
          <Inbox size={32} />
          <span>No waitlist entries match these filters.</span>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {entries.map((entry) => (
                <tr key={entry.id} className="text-sm text-text dark:text-dark-text">
                  <td className="px-4 py-3 font-medium">{entry.name}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono">{entry.phone}</div>
                    {entry.email && (
                      <div className="text-xs text-muted dark:text-dark-muted">{entry.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{entry.city || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${roleBadge(entry.role)}`}>
                      {entry.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${platformBadge(entry.platform)}`}>
                      {entry.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs truncate" title={entry.notes || ''}>
                      {entry.notes || '-'}
                    </div>
                    {entry.source && (
                      <div className="text-[10px] text-muted dark:text-dark-muted mt-0.5 truncate" title={entry.source}>
                        from {entry.source}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10"
                      title="Remove entry"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(n) => {
            setPageSize(n)
            setCurrentPage(1)
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted dark:text-dark-muted">{label}</div>
      <div className="text-xl font-bold text-text dark:text-dark-text mt-1">{value}</div>
    </div>
  )
}
