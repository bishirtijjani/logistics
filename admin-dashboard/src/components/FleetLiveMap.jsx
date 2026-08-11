import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
  Marker as GoogleMarker,
  InfoWindow,
  useMap as useGoogleMap,
} from '@vis.gl/react-google-maps'
import api from '../lib/api'
import { RefreshCw } from 'lucide-react'
import {
  MAPS_KEY,
  ESRI_ATTRIBUTION,
  BasemapSwitcher,
  BasemapLayers,
  useBrandPinIcon,
} from './GoogleBasemap'

const FALLBACK = { lat: 13.0059, lng: 7.6019 } // Katsina city centre

const AVAIL_META = {
  ONLINE:      { label: 'Online',      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  ON_DELIVERY: { label: 'On delivery', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  OFFLINE:     { label: 'Offline',     cls: 'bg-surface-muted text-muted dark:bg-dark-surface-muted dark:text-dark-muted', dot: 'bg-gray-400 dark:bg-dark-muted' },
}

const AvailabilityBadge = ({ availability }) => {
  const m = AVAIL_META[availability] || AVAIL_META.OFFLINE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${availability === 'ONLINE' ? 'animate-pulse' : ''}`} />
      {m.label}
    </span>
  )
}

// Brand pin (lifted from LocationPicker - avoids Leaflet's bundled-asset path issue under Vite).
const RIDER_PIN = L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);color:#EA580C;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z"/>
    </svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
})

// Keeps the map sized correctly when it mounts inside a tab/flex container
// (the invalidateSize fix from LocationPicker, needed to avoid blank tiles).
function MapAutoSize() {
  const map = useMap()
  useEffect(() => {
    const fix = () => map.invalidateSize()
    const raf = requestAnimationFrame(fix)
    const settle = setTimeout(fix, 300)
    const ro = new ResizeObserver(fix)
    ro.observe(map.getContainer())
    window.addEventListener('resize', fix)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
      ro.disconnect()
      window.removeEventListener('resize', fix)
    }
  }, [map])
  return null
}

// Fit the viewport to all rider pins once (not on every 10s poll, which would
// make the map jump while the admin is looking at it).
function FitBounds({ points }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14)
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 14 })
    }
    done.current = true
  }, [points, map])
  return null
}

function FitBoundsGoogle({ points }) {
  const map = useGoogleMap()
  const done = useRef(false)
  useEffect(() => {
    if (!map || !window.google || done.current || points.length === 0) return
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng })
      map.setZoom(14)
    } else {
      const bounds = new window.google.maps.LatLngBounds()
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
      map.fitBounds(bounds, 40)
    }
    done.current = true
  }, [map, points])
  return null
}

function RiderMarkers({ points }) {
  const icon = useBrandPinIcon('#EA580C', 30)
  const [selectedId, setSelectedId] = useState(null)
  const selected = points.find((p) => p.id === selectedId)
  return (
    <>
      {points.map((p) => (
        <GoogleMarker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          icon={icon}
          onClick={() => setSelectedId(p.id)}
        />
      ))}
      {selected && (
        <InfoWindow
          position={{ lat: selected.lat, lng: selected.lng }}
          onCloseClick={() => setSelectedId(null)}
        >
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
            <strong>{selected.name || 'Rider'}</strong>
            <br />
            {selected.availability === 'ON_DELIVERY' ? 'On delivery' : 'Online'}
            {selected.at ? (
              <>
                <br />
                Updated {new Date(selected.at).toLocaleTimeString()}
              </>
            ) : null}
          </div>
        </InfoWindow>
      )}
    </>
  )
}

function GoogleLiveMap({ points }) {
  const [mapType, setMapType] = useState('roadmap')
  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={MAPS_KEY}>
        <GoogleMap
          defaultCenter={{ lat: FALLBACK.lat, lng: FALLBACK.lng }}
          defaultZoom={12}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <BasemapLayers mapType={mapType} />
          <FitBoundsGoogle points={points} />
          <RiderMarkers points={points} />
        </GoogleMap>
      </APIProvider>
      <BasemapSwitcher value={mapType} onChange={setMapType} />
      {mapType === 'esri' && (
        <span className="absolute bottom-0 left-0 z-[400] bg-white/80 dark:bg-black/60 px-1 text-[10px] text-text dark:text-dark-text">
          {ESRI_ATTRIBUTION}
        </span>
      )}
    </div>
  )
}

// Leaflet/CARTO fallback when no browser Maps key is configured.
function LeafletLiveMap({ points }) {
  return (
    <MapContainer center={[FALLBACK.lat, FALLBACK.lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
        detectRetina
      />
      <MapAutoSize />
      <FitBounds points={points} />
      {points.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={RIDER_PIN}>
          <Popup>
            <span className="font-semibold">{p.name || 'Rider'}</span>
            <br />
            {p.availability === 'ON_DELIVERY' ? 'On delivery' : 'Online'}
            {p.at ? <><br />Updated {new Date(p.at).toLocaleTimeString()}</> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

/**
 * Fleet-wide live rider map + active-riders list. Used inside the Dispatch
 * page's "Live Map" view. Polls only while `active` (the caller should pass
 * `active={mainView === 'map'}` so the page doesn't poll a hidden panel).
 */
export default function FleetLiveMap({ active = true }) {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState([])

  const fetchRiderLocations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/riders/realtime')
      setLocations(res.data?.data || [])
    } catch (error) {
      console.error('Failed to fetch rider locations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!active) return
    fetchRiderLocations()
    const interval = setInterval(fetchRiderLocations, 10000)
    return () => clearInterval(interval)
  }, [active])

  const mapPoints = locations
    .filter((r) => typeof r.lastLat === 'number' && typeof r.lastLng === 'number')
    .map((r) => ({ id: r.id, lat: r.lastLat, lng: r.lastLng, name: `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim(), availability: r.availability, at: r.lastLocationAt }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted dark:text-dark-muted">Live fleet positions, refreshed every 10 seconds</p>
        <button
          onClick={fetchRiderLocations}
          className="p-2 px-3 border border-surface-muted dark:border-dark-surface-muted rounded-lg flex items-center gap-2 text-xs text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stacks on mobile (list above map); side-by-side from lg up. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted p-4 sm:p-6 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text dark:text-dark-text">Active Riders</h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{locations.length} live</span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {locations.map((rider) => (
              <div key={rider.id} className="flex items-center justify-between gap-3 p-3 bg-surface-muted dark:bg-dark-surface-muted rounded-xl">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-text dark:text-dark-text truncate">{rider.user?.firstName} {rider.user?.lastName}</p>
                  <p className="text-xs text-muted dark:text-dark-muted">
                    {typeof rider.lastLat === 'number' ? `${rider.lastLat.toFixed(4)}, ${rider.lastLng.toFixed(4)}` : 'No fix'}
                    {rider.lastLocationAt ? ` · ${new Date(rider.lastLocationAt).toLocaleTimeString()}` : ''}
                  </p>
                </div>
                <AvailabilityBadge availability={rider.availability} />
              </div>
            ))}
            {locations.length === 0 && !loading && (
              <p className="text-muted dark:text-dark-muted text-center py-8 text-sm">No riders online right now</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted p-4 sm:p-6 order-1 lg:order-2">
          <h3 className="font-semibold text-text dark:text-dark-text mb-4">Live Map</h3>
          <div className="rounded-xl overflow-hidden border border-surface-muted dark:border-dark-surface-muted" style={{ height: 360 }}>
            {MAPS_KEY ? (
              <GoogleLiveMap points={mapPoints} />
            ) : (
              <LeafletLiveMap points={mapPoints} />
            )}
          </div>
          <p className="text-xs text-muted dark:text-dark-muted mt-2">Showing up to 50 riders</p>
        </div>
      </div>
    </div>
  )
}
