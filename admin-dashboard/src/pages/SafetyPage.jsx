import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'

export default function SafetyPage() {
  const [activeTab, setActiveTab] = useState('compliance')
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [incidentFilter, setIncidentFilter] = useState('ALL')

  const fetchIncidents = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const status = incidentFilter === 'ALL' ? '' : incidentFilter
      const response = await fetch(`/api/admin/safety/incidents?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setIncidents(data.data.incidents || [])
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompliance = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/safety/compliance', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setCompliance(data.data)
    } catch (error) {
      console.error('Failed to fetch compliance:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'compliance') fetchCompliance()
    else fetchIncidents()
  }, [activeTab, incidentFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Safety & Compliance</h1>
        <button onClick={activeTab === 'compliance' ? fetchCompliance : fetchIncidents} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'compliance' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Compliance Report
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'incidents' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Safety Incidents
        </button>
      </div>

      {activeTab === 'compliance' && compliance ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted dark:text-dark-muted">Rider Compliance</p>
                <p className="text-2xl font-bold text-text dark:text-dark-text">
                  {compliance.riderCompliance.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted p-6">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm text-muted dark:text-dark-muted">Merchant Compliance</p>
                <p className="text-2xl font-bold text-text dark:text-dark-text">
                  {compliance.merchantCompliance.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted dark:text-dark-muted">Recent Incidents (30d)</p>
                <p className="text-2xl font-bold text-text dark:text-dark-text">
                  {compliance.recentIncidents}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED'].map(status => (
              <button
                key={status}
                onClick={() => setIncidentFilter(status)}
                className={`px-3 py-1 rounded text-sm ${incidentFilter === status ? 'bg-primary text-white' : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'}`}
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
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident.id} className="border-b">
                      <td className="px-4 py-3">{incident.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{incident.type}</td>
                      <td className="px-4 py-3">{incident.status}</td>
                      <td className="px-4 py-3">{new Date(incident.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {incidents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No incidents found</td>
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
