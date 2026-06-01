import { useEffect, useMemo } from 'react'
import { useMap as useGoogleMap, useApiIsLoaded } from '@vis.gl/react-google-maps'

// Browser-side Maps JavaScript API key (separate from the backend server key
// and from the mobile apps' native SDK key). When unset, callers fall back to
// the Leaflet/CARTO basemap so maps never go blank.
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export const BASEMAPS = [
  { id: 'roadmap', label: 'Streets' },
  { id: 'hybrid', label: 'Satellite' },
  { id: 'esri', label: 'Esri' },
]

export const ESRI_ATTRIBUTION = 'Tiles © Esri'

// Shared teardrop pin path, reused by Leaflet divIcons and Google marker icons
// so a pin looks identical regardless of which engine renders it.
export const PIN_PATH =
  'M12 2C7.589 2 4 5.589 4 9.995C4 14.59 8.6 19.55 11.18 22.04C11.62 22.46 12.38 22.46 12.82 22.04C15.4 19.55 20 14.59 20 9.995C20 5.589 16.411 2 12 2ZM12 12.5C10.62 12.5 9.5 11.38 9.5 10C9.5 8.62 10.62 7.5 12 7.5C13.38 7.5 14.5 8.62 14.5 10C14.5 11.38 13.38 12.5 12 12.5Z'

// Esri's free World Street Map — a different street dataset than OSM, offered
// as a basemap option since OSM is sparse for Katsina. Tile path is
// /tile/{z}/{y}/{x} (row before column).
const esriTileUrl = (coord, zoom) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${coord.y}/${coord.x}`

// Builds a branded teardrop marker icon once the Maps script has loaded so
// google.maps.Size/Point exist. Anchor sits the tip on the coordinate.
export function useBrandPinIcon(color, size = 34) {
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

// Overlaid Tailwind segmented control for picking the basemap.
export function BasemapSwitcher({ value, onChange }) {
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
                ? 'bg-primary text-white'
                : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
            }`}
          >
            {b.label}
          </button>
        )
      })}
    </div>
  )
}

// Place inside a <Map>: registers the custom Esri map type once and applies the
// active basemap whenever it changes. Renders nothing.
export function BasemapLayers({ mapType }) {
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
