import { useState, useEffect } from 'react'
import { MapPin, RefreshCw, Activity, TrendingUp } from 'lucide-react'

export default function RiderOperationsPage() {
  const [activeTab, setActiveTab] = useState('performance')
  const [loading, setLoading] = useState(true)
  const [riders, setRiders] = useState([])
  const [locations, setLocations] = useState([])

  const fetchRiderPerformance = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/riders/performance', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setRiders(data.data.riders || [])
    } catch (error) {
      console.error('Failed to fetch rider performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRiderLocations = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/riders/realtime', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) setLocations(data.data || [])
    } catch (error) {
      console.error('Failed to fetch rider locations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'performance') fetchRiderPerformance()
    else fetchRiderLocations()
    
    const interval = setInterval(() => {
      if (activeTab === 'locations') fetchRiderLocations()
    }, 10000)
    return () => clearInterval(interval)
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-dark-text">Rider Operations</h1>
        <button onClick={activeTab === 'performance' ? fetchRiderPerformance : fetchRiderLocations} className="p-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'performance' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Performance
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2 border-b-2 ${activeTab === 'locations' ? 'border-primary text-primary' : 'border-transparent text-muted dark:text-dark-muted'}`}
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          Real-time Locations
        </button>
      </div>

      {activeTab === 'performance' ? (
        <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left">Rider</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Deliveries</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Available</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((rider) => (
                  <tr key={rider.id} className="border-b">
                    <td className="px-4 py-3">
                      {rider.user?.firstName} {rider.user?.lastName}
                    </td>
                    <td className="px-4 py-3">{rider.user?.email}</td>
                    <td className="px-4 py-3">{rider._count?.deliveries || 0}</td>
                    <td className="px-4 py-3">{rider.status}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${rider.isAvailable ? 'bg-success/10 text-success' : 'bg-surface-muted dark:bg-dark-surface-muted text-muted dark:text-dark-muted'}`}>
                        {rider.isAvailable ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
                {riders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted dark:text-dark-muted">No riders found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted p-6">
            <h3 className="font-semibold text-text dark:text-dark-text mb-4">Active Riders</h3>
            <div className="space-y-2">
              {locations.map((rider) => (
                <div key={rider.id} className="flex items-center justify-between p-3 bg-surface-muted dark:bg-dark-surface-muted rounded">
                  <div>
                    <p className="font-medium text-text dark:text-dark-text">
                      {rider.user?.firstName} {rider.user?.lastName}
                    </p>
                    <p className="text-sm text-muted dark:text-dark-muted">
                      Lat: {rider.currentLat?.toFixed(4)}, Lng: {rider.currentLng?.toFixed(4)}
                    </p>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
              ))}
              {locations.length === 0 && (
                <p className="text-muted dark:text-dark-muted text-center py-4">No active riders</p>
              )}
            </div>
          </div>
          <div className="bg-surface dark:bg-dark-surface rounded-lg border border-surface-muted dark:border-dark-surface-muted p-6">
            <h3 className="font-semibold text-text dark:text-dark-text mb-4">Live Map</h3>
            <div className="h-64 bg-surface-muted dark:bg-dark-surface-muted rounded flex items-center justify-center text-muted dark:text-dark-muted">
              <p>Map visualization will be rendered here</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
