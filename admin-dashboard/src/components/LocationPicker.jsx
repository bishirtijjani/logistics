import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap as useLeafletMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
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
} from './GoogleBasemap'
import { clampToBounds } from '../config/geoRestriction'

// Katsina city centre - same fallback the customer app uses.
const FALLBACK = { lat: 13.0059, lng: 7.6019 }

const PIN_COLOR = '#EA580C'

/* ------------------------------------------------------------------ */
/* Fixed centre pin (reticle)                                          */
/* ------------------------------------------------------------------ */

// A pin locked to the centre of the map viewport while the map pans underneath
// it (the Uber/Bolt "set location on map" pattern, and the one the customer app
// already uses). The selected point is always whatever sits under the centre,
// so the pin can never scroll off-screen - which the old draggable marker did
// the moment you panned the map.
function CenterPin({ color, lifted }) {
  return (
    <>
      {/* Teardrop - its tip rests on the exact centre point. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[450]"
        style={{
          transform: `translate(-50%, calc(-100% + 3px))${lifted ? ' translateY(-6px)' : ''}`,
          transition: 'transform 150ms ease-out',
        }}
      >
        <svg
          width="38"
          height="38"
          viewBox="0 0 24 24"
          fill={color}
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
        >
          <path d={PIN_PATH} />
        </svg>
      </div>
      {/* Ground dot marking the precise centre coordinate under the tip. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[449]"
        style={{
          transform: 'translate(-50%, -50%)',
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Google engine (preferred when VITE_GOOGLE_MAPS_API_KEY is set)      */
/* ------------------------------------------------------------------ */

// Slides the map to an externally selected point (autocomplete) and reports the
// map centre back whenever the *user* finishes moving the map. A short window
// after any programmatic move (and after mount) is ignored so we never
// reverse-geocode a centre the user didn't choose.
function GoogleCenterController({ center, recenterKey, onUserCenter }) {
  const map = useGoogleMap()
  const programmaticUntil = useRef(0)

  // Arm an initial ignore window so the map's first settle (tile loading,
  // invalidateSize, the autocomplete recenter) isn't mistaken for a user move.
  useEffect(() => {
    programmaticUntil.current = Date.now() + 1200
  }, [])

  useEffect(() => {
    if (!map || recenterKey === 0) return
    programmaticUntil.current = Date.now() + 800
    map.panTo({ lat: center.lat, lng: center.lng })
    if ((map.getZoom() || 0) < 16) map.setZoom(16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, recenterKey])

  useEffect(() => {
    if (!map || !window.google) return
    const listener = map.addListener('idle', () => {
      if (Date.now() < programmaticUntil.current) return
      const c = map.getCenter()
      if (c) onUserCenter(c.lat(), c.lng())
    })
    return () => listener.remove()
  }, [map, onUserCenter])

  return null
}

function GoogleCanvas({ center, recenterKey, hasPin, geocoding, onUserCenter }) {
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
          clickableIcons={false}
          style={{ height: '100%', width: '100%' }}
        >
          <BasemapLayers mapType={mapType} />
          <GoogleCenterController center={center} recenterKey={recenterKey} onUserCenter={onUserCenter} />
        </GoogleMap>
      </APIProvider>
      <CenterPin color={PIN_COLOR} lifted={geocoding} />
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

// Leaflet counterpart of GoogleCenterController: recenter on external select,
// report the centre on user-driven moves, ignore programmatic/settle moves.
function LeafletCenterController({ center, recenterKey, onUserCenter }) {
  const map = useLeafletMap()
  const programmaticUntil = useRef(0)

  // Arm an initial ignore window so the map's first settle (tile loading,
  // invalidateSize, the autocomplete recenter) isn't mistaken for a user move.
  useEffect(() => {
    programmaticUntil.current = Date.now() + 1200
  }, [])

  useEffect(() => {
    if (recenterKey === 0) return
    programmaticUntil.current = Date.now() + 800
    map.setView([center.lat, center.lng], Math.max(map.getZoom(), 16), { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  useEffect(() => {
    const handler = () => {
      if (Date.now() < programmaticUntil.current) return
      const c = map.getCenter()
      onUserCenter(c.lat, c.lng)
    }
    map.on('moveend', handler)
    return () => map.off('moveend', handler)
  }, [map, onUserCenter])

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

function LeafletCanvas({ center, recenterKey, hasPin, geocoding, onUserCenter }) {
  return (
    <div className="relative h-full w-full">
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
        <LeafletCenterController center={center} recenterKey={recenterKey} onUserCenter={onUserCenter} />
      </MapContainer>
      <CenterPin color={PIN_COLOR} lifted={geocoding} />
    </div>
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
 * Interaction: a pin is fixed at the centre of the map and the map pans
 * underneath it. Whatever sits under the centre when you stop moving becomes
 * the selected location; picking a search result slides the map so the result
 * lands under the pin.
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
  // Bumped only on an external selection (autocomplete) to ask the map to slide
  // to the new point. The user's own panning never bumps it, so the map and the
  // user never fight over the centre.
  const [recenterKey, setRecenterKey] = useState(0)
  const sessionRef = useRef(`${Date.now()}-${Math.random()}`)
  const searchTimeout = useRef(null)
  const geocodeTimeout = useRef(null)

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current)
  }, [])

  // Reverse-geocode the map centre once the user stops moving the map.
  const handleCenterChange = useCallback((rawLat, rawLng) => {
    // Keep the selection inside the operating area. If the user pans out, snap
    // the map back to the nearest in-area point. No-op when the restriction is
    // disabled (config/geoRestriction.js).
    const clamped = clampToBounds({ lat: rawLat, lng: rawLng })
    const snapped = clamped.lat !== rawLat || clamped.lng !== rawLng
    const newLat = clamped.lat
    const newLng = clamped.lng
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current)
    setGeocoding(true)
    if (snapped) {
      onChange({ lat: newLat, lng: newLng, address })
      setRecenterKey((k) => k + 1)
    }
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
      // Slide the map so the result lands under the fixed centre pin.
      setRecenterKey((k) => k + 1)
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
          <GoogleCanvas center={center} recenterKey={recenterKey} hasPin={hasPin} geocoding={geocoding} onUserCenter={handleCenterChange} />
        ) : (
          <LeafletCanvas center={center} recenterKey={recenterKey} hasPin={hasPin} geocoding={geocoding} onUserCenter={handleCenterChange} />
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
            <span className="text-muted dark:text-dark-muted">Drag the map to place the pin, or search above</span>
          )}
          <div className="text-xs text-muted dark:text-dark-muted mt-0.5">
            {hasPin ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'No pin set'}
          </div>
        </div>
      </div>
    </div>
  )
}
