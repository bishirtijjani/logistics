import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker as LeafletMarker, useMap as useLeafletMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
  Marker as GoogleMarker,
  useMap as useGoogleMap,
} from '@vis.gl/react-google-maps'
import { Search, MapPin, Loader2 } from 'lucide-react'
import api from '../lib/api'
import {
  MAPS_KEY,
  PIN_PATH,
  ESRI_ATTRIBUTION,
  BasemapSwitcher,
  BasemapLayers,
  useBrandPinIcon,
} from './GoogleBasemap'

// Katsina city centre — same fallback the customer app uses.
const FALLBACK = { lat: 13.0059, lng: 7.6019 }

const PIN_COLOR = '#EA580C'

// Inline SVG pin so we don't depend on Leaflet's bundled icon asset paths,
// which Vite doesn't resolve cleanly without extra config.
const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);color:${PIN_COLOR};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="${PIN_PATH}"/>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 32],
})

/* ------------------------------------------------------------------ */
/* Google engine (preferred when VITE_GOOGLE_MAPS_API_KEY is set)      */
/* ------------------------------------------------------------------ */

function PinMarker({ position, onDragEnd }) {
  const icon = useBrandPinIcon(PIN_COLOR, 34)
  return (
    <GoogleMarker
      position={position}
      draggable
      icon={icon}
      onDragEnd={(e) => {
        if (e.latLng) onDragEnd(e.latLng.lat(), e.latLng.lng())
      }}
    />
  )
}

// Recenters when the pinned location changes from outside (autocomplete select).
function Recenter({ lat, lng, hasPin }) {
  const map = useGoogleMap()
  useEffect(() => {
    if (!map || !hasPin) return
    map.panTo({ lat, lng })
    if ((map.getZoom() || 0) < 16) map.setZoom(16)
  }, [map, lat, lng, hasPin])
  return null
}

function GoogleCanvas({ lat, lng, hasPin, center, onPinDrag }) {
  const [mapType, setMapType] = useState('roadmap')
  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={MAPS_KEY}>
        <GoogleMap
          defaultCenter={{ lat: center.lat, lng: center.lng }}
          defaultZoom={hasPin ? 16 : 13}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          {hasPin && <PinMarker position={{ lat, lng }} onDragEnd={onPinDrag} />}
          <BasemapLayers mapType={mapType} />
          <Recenter lat={lat} lng={lng} hasPin={hasPin} />
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

/* ------------------------------------------------------------------ */
/* Leaflet engine (fallback when no browser Maps key is configured)    */
/* ------------------------------------------------------------------ */

function LeafletRecenter({ lat, lng }) {
  const map = useLeafletMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
    }
  }, [lat, lng, map])
  return null
}

// Leaflet sizes its tile grid from the container at init. Inside a
// modal/initially-hidden/animated container that size is wrong on first paint,
// so tiles load for the wrong viewport and labels never resolve (roads show,
// street names don't). Recompute once settled, then track container resizes.
function MapAutoSize() {
  const map = useLeafletMap()
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

function LeafletCanvas({ lat, lng, hasPin, center, onPinDrag }) {
  const markerRef = useRef(null)
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={hasPin ? 16 : 13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
        detectRetina
      />
      <MapAutoSize />
      {hasPin && (
        <LeafletMarker
          ref={markerRef}
          position={[lat, lng]}
          icon={PIN_ICON}
          draggable
          eventHandlers={{
            dragend: () => {
              const m = markerRef.current
              if (!m) return
              const { lat: newLat, lng: newLng } = m.getLatLng()
              onPinDrag(newLat, newLng)
            },
          }}
        />
      )}
      <LeafletRecenter lat={lat} lng={lng} />
    </MapContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * Pin a merchant location on a map and capture address + coordinates together
 * so the address text and the lat/lng can't drift apart. Uses the existing
 * /maps backend endpoints (Google Places under the hood) for search +
 * reverse-geocode. The embedded map uses Google's Maps JavaScript API when a
 * browser key is configured (richest Katsina detail) and falls back to
 * OpenStreetMap/CARTO tiles otherwise.
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
        {MAPS_KEY ? (
          <GoogleCanvas lat={lat} lng={lng} hasPin={hasPin} center={center} onPinDrag={reverseGeocode} />
        ) : (
          <LeafletCanvas lat={lat} lng={lng} hasPin={hasPin} center={center} onPinDrag={reverseGeocode} />
        )}
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
