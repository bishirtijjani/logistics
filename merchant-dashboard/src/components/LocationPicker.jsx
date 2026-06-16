import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polygon as LeafletPolygon, useMap as useLeafletMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
  useMap as useGoogleMap,
} from '@vis.gl/react-google-maps'
import { Search, MapPin, Loader2, Pencil, Check } from 'lucide-react'
import api from '../lib/api'
import { GEO_RESTRICTION, clampToBounds } from '../config/geoRestriction'

const FALLBACK = { lat: 13.0059, lng: 7.6019 }

// Browser-side Maps JavaScript API key. When set, the picker renders Google's
// far more detailed Katsina basemap (streets + business POIs) with a satellite
// and an Esri street layer to switch between. When absent it transparently
// falls back to the Leaflet/CARTO map below so location capture never breaks.
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const PIN_COLOR = '#2563EB'

// Shared teardrop pin path, reused by the fixed centre pin on both engines so
// it looks identical regardless of which engine renders the basemap.
const PIN_PATH =
  'M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z'

// Esri's free World Street Map - a different street dataset than OSM, offered
// as a basemap option since OSM is sparse for Katsina. Tile path is
// /tile/{z}/{y}/{x} (row before column).
const ESRI_ATTRIBUTION = 'Tiles © Esri'
const esriTileUrl = (coord, zoom) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${coord.y}/${coord.x}`

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
/* Edit lock                                                           */
/* ------------------------------------------------------------------ */

// The map is non-interactive until the user taps "Edit". This stops a scroll of
// the page (or the form) from accidentally dragging the map and silently
// changing the saved address - the centre-pin pattern made that far too easy.
// Tapping again ("Done") re-locks it. Search and recentering still work while
// locked because those move the map programmatically, not via gestures.
function MapLockToggle({ locked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`absolute top-2 right-2 z-[500] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-md border transition-colors ${
        locked
          ? 'bg-white dark:bg-dark-surface text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
          : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
      }`}
    >
      {locked ? <Pencil size={14} /> : <Check size={14} />}
      {locked ? 'Edit' : 'Done'}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Google engine (preferred when VITE_GOOGLE_MAPS_API_KEY is set)      */
/* ------------------------------------------------------------------ */

const BASEMAPS = [
  { id: 'roadmap', label: 'Streets' },
  { id: 'hybrid', label: 'Satellite' },
  { id: 'esri', label: 'Esri' },
]

// Overlaid Tailwind segmented control for picking the basemap. Sits top-left so
// the "Edit" lock toggle can own the top-right corner.
function BasemapSwitcher({ value, onChange }) {
  return (
    <div className="absolute top-2 left-2 z-[400] flex rounded-lg overflow-hidden shadow-md border border-surface-muted dark:border-dark-surface-muted">
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

// Registers the custom Esri map type once and applies the active basemap
// whenever it changes. Renders nothing.
function MapBasemap({ mapType }) {
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

  return null
}

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

// Draws the operating-area boundary (Katsina) on the Google map. @vis.gl has no
// declarative Polygon, so we attach a google.maps.Polygon to the map instance.
function GoogleAreaPolygon() {
  const map = useGoogleMap()
  useEffect(() => {
    if (!map || !window.google || !GEO_RESTRICTION.enabled) return
    const poly = new window.google.maps.Polygon({
      paths: GEO_RESTRICTION.polygonPath,
      strokeColor: PIN_COLOR,
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: PIN_COLOR,
      fillOpacity: 0.06,
      clickable: false,
    })
    poly.setMap(map)
    return () => poly.setMap(null)
  }, [map])
  return null
}

function GoogleCanvas({ center, recenterKey, hasPin, geocoding, onUserCenter }) {
  const [mapType, setMapType] = useState('roadmap')
  // Locked by default so the map can't be panned until the user opts in.
  const [locked, setLocked] = useState(true)
  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={MAPS_KEY}>
        <GoogleMap
          defaultCenter={{ lat: center.lat, lng: center.lng }}
          defaultZoom={hasPin ? 16 : 13}
          gestureHandling={locked ? 'none' : 'greedy'}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          style={{ height: '100%', width: '100%' }}
        >
          <MapBasemap mapType={mapType} />
          <GoogleAreaPolygon />
          <GoogleCenterController center={center} recenterKey={recenterKey} onUserCenter={onUserCenter} />
        </GoogleMap>
      </APIProvider>
      <CenterPin color={PIN_COLOR} lifted={geocoding} />
      <MapLockToggle locked={locked} onToggle={() => setLocked((v) => !v)} />
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

// Enables/disables Leaflet's interaction handlers in step with the lock state.
// react-leaflet only reads its interaction props at init, so the toggle has to
// happen imperatively against the live map.
function LeafletLock({ locked }) {
  const map = useLeafletMap()
  useEffect(() => {
    const handlers = ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'touchZoom', 'boxZoom', 'keyboard', 'tap']
    handlers.forEach((name) => {
      const handler = map[name]
      if (!handler) return
      if (locked) handler.disable()
      else handler.enable()
    })
  }, [map, locked])
  return null
}

function LeafletCanvas({ center, recenterKey, hasPin, geocoding, onUserCenter }) {
  // Locked by default so the map can't be panned until the user opts in.
  const [locked, setLocked] = useState(true)
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={hasPin ? 16 : 13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
          detectRetina
        />
        <MapAutoSize />
        <LeafletLock locked={locked} />
        {GEO_RESTRICTION.enabled && (
          <LeafletPolygon
            positions={GEO_RESTRICTION.polygonPath.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: PIN_COLOR, weight: 2, fillColor: PIN_COLOR, fillOpacity: 0.06 }}
          />
        )}
        <LeafletCenterController center={center} recenterKey={recenterKey} onUserCenter={onUserCenter} />
      </MapContainer>
      <CenterPin color={PIN_COLOR} lifted={geocoding} />
      <MapLockToggle locked={locked} onToggle={() => setLocked((v) => !v)} />
    </div>
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
  // Set when a searched place resolves outside the operating area (search is
  // biased, not strictly bounded - the backend flags it with outOfArea).
  const [areaError, setAreaError] = useState('')
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
    setAreaError('')
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
      // Search is biased, not strictly bounded - refuse a result outside the area.
      if (payload?.outOfArea) {
        setAreaError(`That place is outside our service area (${GEO_RESTRICTION.label}).`)
        return
      }
      if (payload?.lat != null && payload?.lng != null) {
        onChange({
          lat: payload.lat,
          lng: payload.lng,
          address: payload.formattedAddress,
        })
        // Slide the map so the result lands under the fixed centre pin.
        setRecenterKey((k) => k + 1)
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

      {areaError && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <MapPin size={16} className="flex-shrink-0" />
          <span>{areaError}</span>
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted" style={{ height: 280 }}>
        {MAPS_KEY ? (
          <GoogleCanvas center={center} recenterKey={recenterKey} hasPin={hasPin} geocoding={geocoding} onUserCenter={handleCenterChange} />
        ) : (
          <LeafletCanvas center={center} recenterKey={recenterKey} hasPin={hasPin} geocoding={geocoding} onUserCenter={handleCenterChange} />
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
            <span className="text-muted dark:text-dark-muted">Tap “Edit” to move the map, or search above</span>
          )}
          <div className="text-xs text-muted dark:text-dark-muted mt-0.5">
            {hasPin ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'No pin set'}
          </div>
        </div>
      </div>
    </div>
  )
}
