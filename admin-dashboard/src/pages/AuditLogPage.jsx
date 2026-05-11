import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchAuditLogs } from '../store/slices/auditLogsSlice'
import { Search, Filter, Calendar, User as UserIcon, ChevronDown, ChevronUp } from 'lucide-react'
import Pagination from '../components/Pagination'

const ACTION_COLORS = {
  APPROVE: 'bg-green-100 text-green-800',
  REJECT: 'bg-red-100 text-red-800',
  SUSPEND: 'bg-orange-100 text-orange-800',
  UNSUSPEND: 'bg-blue-100 text-blue-800',
  UPDATE: 'bg-purple-100 text-purple-800',
  CREATE: 'bg-cyan-100 text-cyan-800',
  DELETE: 'bg-pink-100 text-pink-800',
  CANCEL: 'bg-gray-100 text-gray-800',
}

export default function AuditLogPage() {
  const dispatch = useDispatch()
  const { logs, total, page, loading } = useSelector((state) => state.auditLogs)
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  })
  const [pageSize, setPageSize] = useState(20)
  const [expandedLog, setExpandedLog] = useState(null)

  useEffect(() => {
    dispatch(fetchAuditLogs({ page: 1, limit: 20 }))
  }, [dispatch])

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleSearch = () => {
    dispatch(fetchAuditLogs({ page: 1, limit: 20, ...filters }))
  }

  const handlePageChange = (newPage) => {
    dispatch(fetchAuditLogs({ page: newPage, limit: pageSize, ...filters }))
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    dispatch(fetchAuditLogs({ page: 1, limit: newPageSize, ...filters }))
  }

  const toggleExpand = (logId) => {
    setExpandedLog(expandedLog === logId ? null : logId)
  }

  const getActionColor = (action) => {
    for (const [key, value] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return value
    }
    return 'bg-gray-100 text-gray-800'
  }

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-6">Audit Logs</h1>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 lg:items-center">
          <input
            type="text"
            placeholder="Filter by action"
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text text-sm w-full lg:w-auto"
          />
          <select
            value={filters.entityType}
            onChange={(e) => handleFilterChange('entityType', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text text-sm w-full lg:w-auto"
          >
            <option value="">All Entity Types</option>
            <option value="MERCHANT">Merchant</option>
            <option value="USER">User</option>
            <option value="RIDER">Rider</option>
            <option value="REQUEST">Request</option>
            <option value="TRANSACTION">Transaction</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text text-sm w-full lg:w-auto"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-dark-surface-muted dark:text-dark-text text-sm w-full lg:w-auto"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 text-sm w-full lg:w-auto"
          >
            <Filter size={18} />
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted dark:text-dark-muted">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted border-b border-surface-muted dark:border-dark-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Admin</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-muted dark:text-dark-muted uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-muted dark:divide-dark-surface-muted">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-surface-muted dark:hover:bg-dark-surface-muted cursor-pointer" onClick={() => toggleExpand(log.id)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        <UserIcon size={16} />
                        {log.adminUser?.firstName} {log.adminUser?.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      {log.entityType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-muted dark:text-dark-muted">
                      #{log.entityId.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted dark:text-dark-muted">
                      <div className="flex items-center gap-2">
                        {expandedLog === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {log.details ? 'View details' : '-'}
                      </div>
                    </td>
                  </tr>
                  {expandedLog === log.id && log.details && (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 bg-surface-muted dark:bg-dark-surface-muted">
                        <div className="text-sm">
                          <p className="font-semibold text-text dark:text-dark-text mb-2">Details:</p>
                          <pre className="bg-surface-muted dark:bg-dark-surface-muted p-3 rounded-lg overflow-auto max-h-40 text-xs dark:text-dark-text">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                          {log.ipAddress && (
                            <p className="mt-2 text-muted dark:text-dark-muted">
                              <span className="font-semibold">IP:</span> {log.ipAddress}
                            </p>
                          )}
                          {log.userAgent && (
                            <p className="mt-1 text-muted dark:text-dark-muted">
                              <span className="font-semibold">User Agent:</span> {log.userAgent}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize)}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
