import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Search, MapPin, Loader2 } from 'lucide-react'
import api from '../lib/api'

// Katsina city centre — same fallback the customer app uses.
const FALLBACK = { lat: 13.0059, lng: 7.6019 }

// Inline SVG pin so we don't depend on Leaflet's bundled icon asset paths,
// which Vite doesn't resolve cleanly without extra config.
const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);color:#EA580C;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z"/>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
})

// Recenters the map whenever the pinned location changes from outside
// (e.g. user picks a place from the autocomplete dropdown).
function Recenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
    }
  }, [lat, lng, map])
  return null
}

/**
 * Pin a merchant location on a map and capture address + coordinates together
 * so the address text and the lat/lng can't drift apart. Uses the existing
 * /maps backend endpoints (Google Places under the hood) for search +
 * reverse-geocode; the embedded map is OpenStreetMap tiles so no browser-side
 * Google Maps key is required.
 *
 * value: { address: string, lat: number, lng: number }
 * onChange: ({ address, lat, lng }) => void
 */
export default function LocationPicker({ value, onChange }) {
  const address = value?.address || ''
  const lat = typeof value?.lat === 'number' ? value.lat : 0
  const lng = typeof value?.lng === 'number' ? value.lng : 0

  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])
  const [searching, setSearching] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const sessionRef = useRef(`${Date.now()}-${Math.random()}`)
  const searchTimeout = useRef(null)
  const geocodeTimeout = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current)
  }, [])

  const reverseGeocode = useCallback((newLat, newLng) => {
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current)
    setGeocoding(true)
    // Fallback string is >= 5 chars so backend validation (address.min(5))
    // never rejects a pin just because reverse-geocode returned nothing.
    const coordFallback = `Pin at ${newLat.toFixed(5)}, ${newLng.toFixed(5)}`
    geocodeTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/maps/reverse-geocode', {
          params: { lat: newLat, lng: newLng },
        })
        onChange({ lat: newLat, lng: newLng, address: data?.formattedAddress || address || coordFallback })
      } catch {
        onChange({ lat: newLat, lng: newLng, address: address || coordFallback })
      } finally {
        setGeocoding(false)
      }
    }, 400)
  }, [address, onChange])

  const handleSearch = (text) => {
    setQuery(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (text.trim().length < 2) {
      setPredictions([])
      return
    }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/maps/autocomplete', {
          params: { query: text, sessionToken: sessionRef.current },
        })
        setPredictions(Array.isArray(data) ? data : [])
      } catch {
        setPredictions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleSelectPrediction = async (prediction) => {
    setQuery('')
    setPredictions([])
    setGeocoding(true)
    try {
      const { data } = await api.get('/maps/place-details', {
        params: { placeId: prediction.placeId, sessionToken: sessionRef.current },
      })
      sessionRef.current = `${Date.now()}-${Math.random()}`
      onChange({
        lat: data.lat,
        lng: data.lng,
        address: data.formattedAddress,
      })
    } catch {
      // ignore
    } finally {
      setGeocoding(false)
    }
  }

  const handleMarkerDragEnd = () => {
    const marker = markerRef.current
    if (!marker) return
    const { lat: newLat, lng: newLng } = marker.getLatLng()
    reverseGeocode(newLat, newLng)
  }

  const center = lat && lng ? { lat, lng } : FALLBACK
  const hasPin = lat !== 0 && lng !== 0

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a business or address…"
            className="w-full pl-10 pr-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          {searching && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
          )}
        </div>
        {predictions.length > 0 && (
          <ul className="absolute z-[1000] left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-surface dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg shadow-lg">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  onClick={() => handleSelectPrediction(p)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
                >
                  <div className="text-sm font-medium text-text dark:text-dark-text">{p.mainText}</div>
                  <div className="text-xs text-muted dark:text-dark-muted">{p.secondaryText}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted" style={{ height: 280 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={hasPin ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {hasPin && (
            <Marker
              ref={markerRef}
              position={[lat, lng]}
              icon={PIN_ICON}
              draggable
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />
          )}
          <Recenter lat={lat} lng={lng} />
        </MapContainer>
      </div>

      {/* Status row */}
      <div className="flex items-start gap-2 text-sm">
        <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {geocoding ? (
            <span className="text-muted dark:text-dark-muted">Looking up address…</span>
          ) : address ? (
            <span className="text-text dark:text-dark-text">{address}</span>
          ) : (
            <span className="text-muted dark:text-dark-muted">Search above or drag the pin to set location</span>
          )}
          <div className="text-xs text-muted dark:text-dark-muted mt-0.5">
            {hasPin ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'No pin set'}
          </div>
        </div>
      </div>
    </div>
  )
}
