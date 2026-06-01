import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker as LeafletMarker, useMap as useLeafletMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
  Marker as GoogleMarker,
  useMap as useGoogleMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { Search, MapPin, Loader2 } from 'lucide-react'
import api from '../lib/api'

const FALLBACK = { lat: 13.0059, lng: 7.6019 }

// Browser-side Maps JavaScript API key. When set, the picker renders Google's
// far more detailed Katsina basemap (streets + business POIs) with a satellite
// and an Esri street layer to switch between. When absent it transparently
// falls back to the Leaflet/CARTO map below so location capture never breaks.
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const PIN_COLOR = '#2563EB'

// Shared teardrop pin path, reused by both the Leaflet divIcon and the Google
// marker icon so the pin looks identical regardless of which engine renders.
const PIN_PATH =
  'M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z'

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

// Esri's free World Street Map — a different street dataset than OSM, offered
// as a basemap option since OSM is sparse for Katsina. Tile path is
// /tile/{z}/{y}/{x} (row before column).
const ESRI_ATTRIBUTION = 'Tiles © Esri'
const esriTileUrl = (coord, zoom) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${coord.y}/${coord.x}`

/* ------------------------------------------------------------------ */
/* Google engine (preferred when VITE_GOOGLE_MAPS_API_KEY is set)      */
/* ------------------------------------------------------------------ */

const BASEMAPS = [
  { id: 'roadmap', label: 'Streets' },
  { id: 'hybrid', label: 'Satellite' },
  { id: 'esri', label: 'Esri' },
]

// Overlaid Tailwind segmented control for picking the basemap.
function BasemapSwitcher({ value, onChange }) {
  return (
    <div className="absolute top-2 right-2 z-[400] flex rounded-lg overflow-hidden shadow-md border border-surface-muted dark:border-dark-surface-muted">
      {BASEMAPS.map((b) => {
        const active = value === b.id
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(b.id)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-dark-surface text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
            }`}
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}

// Draggable branded pin for the Google engine. Builds the icon only once the
// Maps script has loaded so google.maps.Size/Point exist.
function PinMarker({ position, onDragEnd }) {
  const apiLoaded = useApiIsLoaded()
  const icon = useMemo(() => {
    if (!apiLoaded || !window.google) return undefined
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="${PIN_COLOR}"><path d="${PIN_PATH}"/></svg>`
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(34, 34),
      anchor: new window.google.maps.Point(17, 32),
    }
  }, [apiLoaded])
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

// Registers the custom Esri map type, applies the active basemap, and recenters
// when the pinned location changes from outside (e.g. autocomplete select).
function MapController({ lat, lng, hasPin, mapType }) {
  const map = useGoogleMap()

  useEffect(() => {
    if (!map || !window.google || map.mapTypes.get('esri')) return
    map.mapTypes.set(
      'esri',
      new window.google.maps.ImageMapType({
        name: 'Esri',
        tileSize: new window.google.maps.Size(256, 256),
        minZoom: 1,
        maxZoom: 19,
        getTileUrl: esriTileUrl,
      })
    )
  }, [map])

  useEffect(() => {
    if (map) map.setMapTypeId(mapType)
  }, [map, mapType])

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
          <MapController lat={lat} lng={lng} hasPin={hasPin} mapType={mapType} />
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

function Recenter({ lat, lng }) {
  const map = useLeafletMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
    }
  }, [lat, lng, map])
  return null
}

// Leaflet computes its tile grid from the container size at init. Inside a
// modal/animated/initially-hidden container that size is wrong on first paint,
// so tiles load for the wrong viewport and labels never resolve (you see roads
// but no street names). Recompute once the container settles, then keep it in
// sync with any resize (modal open, sidebar toggle, orientation change).
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
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * Pin a merchant location on a map and capture address + coordinates together
 * so the address text and the lat/lng can't drift apart. Hits the backend
 * /maps endpoints (Google Places under the hood) for search +
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
        const response = await api.get('/maps/reverse-geocode', {
          params: { lat: newLat, lng: newLng },
        })
        const payload = response.data?.data
        onChange({ lat: newLat, lng: newLng, address: payload?.formattedAddress || address || coordFallback })
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
        const response = await api.get('/maps/autocomplete', {
          params: { query: text, sessionToken: sessionRef.current },
        })
        const payload = response.data?.data
        setPredictions(Array.isArray(payload) ? payload : [])
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
      const response = await api.get('/maps/place-details', {
        params: { placeId: prediction.placeId, sessionToken: sessionRef.current },
      })
      const payload = response.data?.data
      sessionRef.current = `${Date.now()}-${Math.random()}`
      if (payload?.lat != null && payload?.lng != null) {
        onChange({
          lat: payload.lat,
          lng: payload.lng,
          address: payload.formattedAddress,
        })
      }
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
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a business or address…"
            className="w-full pl-10 pr-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-white dark:bg-dark-surface text-text dark:text-dark-text focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {searching && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted animate-spin" />
          )}
        </div>
        {predictions.length > 0 && (
          // z-[1100] sits above Leaflet's zoom control (which uses z-index 1000)
          // so the +/- buttons can't bleed through the search results.
          <ul className="absolute z-[1100] left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-dark-surface border border-surface-muted dark:border-dark-surface-muted rounded-lg shadow-lg">
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

      <div className="rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted" style={{ height: 280 }}>
        {MAPS_KEY ? (
          <GoogleCanvas lat={lat} lng={lng} hasPin={hasPin} center={center} onPinDrag={reverseGeocode} />
        ) : (
          <LeafletCanvas lat={lat} lng={lng} hasPin={hasPin} center={center} onPinDrag={reverseGeocode} />
        )}
      </div>

      <div className="flex items-start gap-2 text-sm">
        <MapPin size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
