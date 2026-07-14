import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  APIProvider,
  Map as GoogleMap,
  Marker as GoogleMarker,
  useMap as useGoogleMap,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { Bike, Clock } from 'lucide-react'
import api from '../lib/api'
import trackingSocket from '../services/trackingSocket'
import { decodePolyline } from '../lib/polyline'
import { TRACKABLE_STATUSES } from '../lib/tracking'

// Browser-side Maps JavaScript API key. When set, tracking renders on Google's
// far more detailed Katsina basemap; when absent it transparently falls back
// to the Leaflet/CARTO map so tracking never goes blank (same pattern as
// LocationPicker).
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const PICKUP_COLOR = '#2563EB'
const DROPOFF_COLOR = '#16A34A'
const RIDER_COLOR = '#EA580C'
const FALLBACK = { lat: 13.0059, lng: 7.6019 } // Katsina city centre

// Shared teardrop pin path (same asset LocationPicker uses), rendered as a
// divIcon to dodge Leaflet's bundled-asset path issue under Vite.
const PIN_PATH =
  'M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z'

const leafletPin = (color, size = 30) =>
  L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-100%);color:${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="${PIN_PATH}"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
  })

const PINS = {
  pickup: leafletPin(PICKUP_COLOR),
  dropoff: leafletPin(DROPOFF_COLOR),
  rider: leafletPin(RIDER_COLOR, 34),
}

// Builds a branded teardrop marker icon once the Maps script has loaded so
// google.maps.Size/Point exist. Anchor sits the tip on the coordinate.
function useBrandPinIcon(color, size = 30) {
  const apiLoaded = useApiIsLoaded()
  return useMemo(() => {
    if (!apiLoaded || !window.google) return undefined
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${PIN_PATH}"/></svg>`
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, Math.round((size * 32) / 34)),
    }
  }, [apiLoaded, color, size])
}

const isPoint = (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number'

const etaLabel = (eta) => {
  if (!eta || typeof eta.seconds !== 'number') return null
  const mins = Math.max(1, Math.round(eta.seconds / 60))
  return `~${mins} min to ${eta.nextCheckpoint === 'PICKUP' ? 'pickup' : 'dropoff'}`
}

/* ------------------------------------------------------------------ */
/* Leaflet engine (fallback when no browser Maps key is configured)    */
/* ------------------------------------------------------------------ */

// invalidateSize fix so tiles render correctly inside the modal (see
// LocationPicker for the full story).
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

// Fit the viewport to the pins, refitting only when a pin appears/disappears
// (e.g. the rider's first position arrives) - never on every 3s movement,
// which would fight the viewer's own panning.
function FitBounds({ points }) {
  const map = useMap()
  const fitted = useRef(0)
  useEffect(() => {
    if (points.length === 0 || points.length === fitted.current) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15)
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 })
    }
    fitted.current = points.length
  }, [points, map])
  return null
}

function LeafletTrackingMap({ pickup, dropoff, rider, route, boundsPoints }) {
  const center = boundsPoints[0] || FALLBACK
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
        detectRetina
      />
      <MapAutoSize />
      <FitBounds points={boundsPoints} />
      {route.length > 1 && (
        <Polyline positions={route.map((p) => [p.lat, p.lng])} pathOptions={{ color: RIDER_COLOR, weight: 4, opacity: 0.75 }} />
      )}
      {isPoint(pickup) && (
        <Marker position={[pickup.lat, pickup.lng]} icon={PINS.pickup}>
          <Tooltip>{pickup.label || 'Pickup'}</Tooltip>
        </Marker>
      )}
      {isPoint(dropoff) && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={PINS.dropoff}>
          <Tooltip>{dropoff.label || 'Dropoff'}</Tooltip>
        </Marker>
      )}
      {isPoint(rider) && (
        <Marker position={[rider.lat, rider.lng]} icon={PINS.rider}>
          <Tooltip>Rider</Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Google engine (preferred when VITE_GOOGLE_MAPS_API_KEY is set)      */
/* ------------------------------------------------------------------ */

function FitBoundsGoogle({ points }) {
  const map = useGoogleMap()
  const fitted = useRef(0)
  useEffect(() => {
    if (!map || !window.google || points.length === 0 || points.length === fitted.current) return
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng })
      map.setZoom(15)
    } else {
      const bounds = new window.google.maps.LatLngBounds()
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
      map.fitBounds(bounds, 40)
    }
    fitted.current = points.length
  }, [map, points])
  return null
}

// @vis.gl has no declarative Polyline - attach a google.maps.Polyline to the
// map instance imperatively (same trick as LocationPicker's area polygon).
function GoogleRoutePolyline({ points }) {
  const map = useGoogleMap()
  useEffect(() => {
    if (!map || !window.google || points.length < 2) return
    const poly = new window.google.maps.Polyline({
      path: points,
      strokeColor: RIDER_COLOR,
      strokeOpacity: 0.75,
      strokeWeight: 4,
      clickable: false,
    })
    poly.setMap(map)
    return () => poly.setMap(null)
  }, [map, points])
  return null
}

function GoogleMarkers({ pickup, dropoff, rider }) {
  const pickupIcon = useBrandPinIcon(PICKUP_COLOR, 30)
  const dropoffIcon = useBrandPinIcon(DROPOFF_COLOR, 30)
  const riderIcon = useBrandPinIcon(RIDER_COLOR, 34)
  return (
    <>
      {isPoint(pickup) && <GoogleMarker position={{ lat: pickup.lat, lng: pickup.lng }} icon={pickupIcon} title={pickup.label || 'Pickup'} />}
      {isPoint(dropoff) && <GoogleMarker position={{ lat: dropoff.lat, lng: dropoff.lng }} icon={dropoffIcon} title={dropoff.label || 'Dropoff'} />}
      {isPoint(rider) && <GoogleMarker position={{ lat: rider.lat, lng: rider.lng }} icon={riderIcon} title="Rider" />}
    </>
  )
}

function GoogleTrackingMap({ pickup, dropoff, rider, route, boundsPoints }) {
  const center = boundsPoints[0] || FALLBACK
  return (
    <APIProvider apiKey={MAPS_KEY}>
      <GoogleMap
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={13}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        style={{ height: '100%', width: '100%' }}
      >
        <FitBoundsGoogle points={boundsPoints} />
        <GoogleRoutePolyline points={route} />
        <GoogleMarkers pickup={pickup} dropoff={dropoff} rider={rider} />
      </GoogleMap>
    </APIProvider>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

/**
 * Live per-order tracking map - the merchant counterpart of the customer
 * app's RequestTrackingScreen map.
 *
 * Seeds from GET /requests/:id/route (participant-authorised - the merchant
 * on the order passes; returns the rider's last Redis position + route
 * polyline + ETA), then follows the rider in real time via the request's
 * socket room. The seed is re-polled every 30s (matching the server-side
 * route cache TTL) so the polyline/ETA stay fresh and the map still moves
 * if the socket is down.
 *
 * Renders nothing unless `status` is in TRACKABLE_STATUSES.
 */
export default function LiveTrackingMap({ requestId, status, pickup, dropoff }) {
  const [rider, setRider] = useState(null) // { lat, lng, at }
  const [eta, setEta] = useState(null) // { seconds, nextCheckpoint }
  const [route, setRoute] = useState([])
  // Follows request:status:changed from the room so the map retires itself
  // when the delivery completes while the viewer is watching (the `status`
  // prop is a snapshot from when the modal was opened). Adjusted during
  // render (not in an effect) per react.dev's derived-state guidance.
  const [liveStatus, setLiveStatus] = useState(status)
  const [prevStatus, setPrevStatus] = useState(status)
  if (status !== prevStatus) {
    setPrevStatus(status)
    setLiveStatus(status)
  }
  const active = TRACKABLE_STATUSES.includes(liveStatus)

  useEffect(() => {
    if (!requestId || !active) return undefined
    let cancelled = false

    const seed = async () => {
      try {
        const res = await api.get(`/requests/${requestId}/route`)
        const d = res.data?.data
        if (cancelled || !d) return
        if (typeof d.riderLat === 'number' && typeof d.riderLng === 'number') {
          setRider({ lat: d.riderLat, lng: d.riderLng, at: d.computedAt || Date.now() })
        }
        setRoute(d.polyline ? decodePolyline(d.polyline) : [])
        setEta(typeof d.etaSeconds === 'number' ? { seconds: d.etaSeconds, nextCheckpoint: d.nextCheckpoint } : null)
      } catch {
        // Non-fatal: socket events still move the rider pin.
      }
    }
    seed()
    const interval = setInterval(seed, 30000)

    trackingSocket.joinRequestRoom(requestId)
    const unsubLocation = trackingSocket.onRequestRiderLocation((data) => {
      if (data?.requestId !== requestId) return
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return
      setRider({ lat: data.lat, lng: data.lng, at: data.timestamp || Date.now() })
    })
    const unsubEta = trackingSocket.onRequestRiderEta((data) => {
      if (data?.requestId !== requestId) return
      if (typeof data.etaSeconds === 'number') setEta({ seconds: data.etaSeconds, nextCheckpoint: data.nextCheckpoint })
    })
    const unsubStatus = trackingSocket.onRequestStatusChanged((data) => {
      if (data?.requestId === requestId && data.status) setLiveStatus(data.status)
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      unsubLocation()
      unsubEta()
      unsubStatus()
      trackingSocket.leaveRequestRoom(requestId)
    }
  }, [requestId, active])

  if (!active) return null

  const boundsPoints = [pickup, dropoff, rider].filter(isPoint)
  const chip = etaLabel(eta)

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-lg overflow-hidden border border-surface-muted dark:border-dark-surface-muted" style={{ height: 288 }}>
        {MAPS_KEY ? (
          <GoogleTrackingMap pickup={pickup} dropoff={dropoff} rider={rider} route={route} boundsPoints={boundsPoints} />
        ) : (
          <LeafletTrackingMap pickup={pickup} dropoff={dropoff} rider={rider} route={route} boundsPoints={boundsPoints} />
        )}
        {chip && (
          <span className="absolute top-2 left-2 z-[500] inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-dark-surface/95 px-2.5 py-1 text-xs font-medium text-text dark:text-dark-text shadow-md border border-surface-muted dark:border-dark-surface-muted">
            <Clock size={12} className="text-blue-600" />
            {chip}
          </span>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted dark:text-dark-muted">
        <Bike size={12} />
        {rider
          ? `Rider position updated ${new Date(rider.at).toLocaleTimeString()}`
          : "Waiting for the rider's live position…"}
      </p>
    </div>
  )
}
