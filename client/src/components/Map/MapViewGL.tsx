import { useEffect, useRef, useMemo, useState, createElement, type RefObject } from 'react'
import MapPlaceHoverPreview from './MapPlaceHoverPreview'
import { useMapPlaceHover, type MapHoverPlace } from './useMapPlaceHover'
import MapPlaceClusterHoverPreview from './MapPlaceClusterHoverPreview'
import {
  MAP_CLUSTER_MAX_ZOOM,
  MAP_CLUSTER_MIN_POINTS,
  MAP_CLUSTER_RADIUS,
  MAP_MARKER_MIN_ZOOM,
  placesToClusterGeoJSON,
} from './mapClusterConfig'
import { renderToStaticMarkup } from 'react-dom/server'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { getCached, isLoading, fetchPhoto, onThumbReady, getAllThumbs, displayPhotoSrc } from '../../services/photoService'
import { placePhotoFetchId } from '../../utils/placePhotoUrls'
import { CATEGORY_ICON_MAP } from '../shared/categoryIcons'
import { isStandardFamily, supportsCustom3d, wantsTerrain, addCustom3dBuildings, addTerrainAndSky } from './mapboxSetup'
import { attachLocationMarker, type LocationMarkerHandle } from './locationMarkerMapbox'
import { ReservationMapboxOverlay } from './reservationsMapbox'
import LocationButton from './LocationButton'
import { useGeolocation } from '../../hooks/useGeolocation'
import type { Place, Reservation } from '../../types'

function categoryIconSvg(iconName: string | null | undefined, size: number): string {
  const IconComponent = (iconName && CATEGORY_ICON_MAP[iconName]) || CATEGORY_ICON_MAP['MapPin']
  try {
    return renderToStaticMarkup(createElement(IconComponent, { size, color: 'white', strokeWidth: 2.5 }))
  } catch { return '' }
}

interface RouteSegment {
  mid: [number, number]
  from: [number, number]
  to: [number, number]
  walkingText?: string
  drivingText?: string
}

interface Props {
  places: Place[]
  dayPlaces?: Place[]
  route?: [number, number][][] | null
  routeSegments?: RouteSegment[]
  selectedPlaceId?: number | null
  onMarkerClick?: (id: number) => void
  onMapClick?: (info: { latlng: { lat: number; lng: number } }) => void
  onMapContextMenu?: ((e: { latlng: { lat: number; lng: number }; originalEvent: MouseEvent }) => void) | null
  center?: [number, number]
  zoom?: number
  fitKey?: number | null
  dayOrderMap?: Record<number, number[] | null>
  leftWidth?: number
  rightWidth?: number
  hasInspector?: boolean
  hasDayDetail?: boolean
  reservations?: Reservation[]
  visibleConnectionIds?: number[]
  showReservationStats?: boolean
  onReservationClick?: (reservationId: number) => void
}

function createMarkerElement(place: Place & { category_color?: string; category_icon?: string }, photoUrl: string | null, orderNumbers: number[] | null, selected: boolean): HTMLDivElement {
  const size = selected ? 44 : 36
  const borderColor = selected ? '#111827' : 'white'
  const borderWidth = selected ? 3 : 2.5
  const shadow = selected
    ? '0 0 0 3px rgba(17,24,39,0.25), 0 4px 14px rgba(0,0,0,0.3)'
    : '0 2px 8px rgba(0,0,0,0.22)'
  const bgColor = place.category_color || '#6b7280'

  // The visual circle is `size` + 2*border on each side. To make the
  // mapbox `anchor: 'center'` land on the real visual middle of the marker
  // (rather than just the inner content box), the wrapper has to be the
  // full outer size. If we gave the wrapper only `size`, the border would
  // bleed outside it and the route lines would appear slightly off.
  const outer = size + borderWidth * 2

  let badgeHtml = ''
  if (orderNumbers && orderNumbers.length > 0) {
    const label = orderNumbers.join(' · ')
    badgeHtml = `<span style="
      position:absolute;bottom:-2px;right:-2px;
      min-width:18px;height:${orderNumbers.length > 1 ? 16 : 18}px;border-radius:${orderNumbers.length > 1 ? 8 : 9}px;
      padding:0 ${orderNumbers.length > 1 ? 4 : 3}px;
      background:rgba(255,255,255,0.94);
      border:1.5px solid rgba(0,0,0,0.15);
      box-shadow:0 1px 4px rgba(0,0,0,0.18);
      display:flex;align-items:center;justify-content:center;
      font-size:${orderNumbers.length > 1 ? 7.5 : 9}px;font-weight:800;color:#111827;
      font-family:-apple-system,system-ui,sans-serif;line-height:1;
      box-sizing:border-box;white-space:nowrap;
    ">${label}</span>`
  }

  const wrap = document.createElement('div')
  // Do NOT set `position: relative` here — mapbox-gl ships
  // `.mapboxgl-marker { position: absolute }` and relies on it. An inline
  // `position: relative` here overrides the class, turns every marker into
  // a static block element, and stacks them in document order inside the
  // canvas container. The result looks exactly like "markers drift as the
  // map zooms" because each marker's transform is then applied relative
  // to its stacked slot, not to the map viewport.
  wrap.style.cssText = `width:${outer}px;height:${outer}px;cursor:pointer;`

  const hasPhoto = Boolean(photoUrl && (
    photoUrl.startsWith('data:')
    || photoUrl.startsWith('/api/')
    || photoUrl.startsWith('http://')
    || photoUrl.startsWith('https://')
  ))
  if (hasPhoto) {
    wrap.innerHTML = `
      <div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${size}px;height:${size}px;border-radius:50%;
        border:${borderWidth}px solid ${borderColor};
        box-shadow:${shadow};
        overflow:hidden;background:${bgColor};
        box-sizing:content-box;
      ">
        <img src="${photoUrl}" width="${size}" height="${size}" style="display:block;border-radius:50%;object-fit:cover;" />
      </div>
      ${badgeHtml}
    `
  } else {
    wrap.innerHTML = `
      <div style="
        position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        width:${size}px;height:${size}px;border-radius:50%;
        border:${borderWidth}px solid ${borderColor};
        box-shadow:${shadow};
        background:${bgColor};
        display:flex;align-items:center;justify-content:center;
        box-sizing:content-box;
      ">
        ${categoryIconSvg(place.category_icon, selected ? 18 : 15)}
      </div>
      ${badgeHtml}
    `
  }
  return wrap
}

function isDisplayablePhotoUrl(photoUrl: string | null | undefined): photoUrl is string {
  if (!photoUrl) return false
  return photoUrl.startsWith('data:')
    || photoUrl.startsWith('/api/')
    || photoUrl.startsWith('http://')
    || photoUrl.startsWith('https://')
}

/** Update marker DOM in place when only the photo URL changed (avoids recreating mapboxgl.Marker). */
function applyMarkerPhoto(
  el: HTMLDivElement,
  place: Place & { category_color?: string; category_icon?: string },
  photoUrl: string | null,
  orderNumbers: number[] | null,
  selected: boolean,
) {
  const img = el.querySelector('img')
  if (img && isDisplayablePhotoUrl(photoUrl)) {
    if (img.getAttribute('src') !== photoUrl) img.setAttribute('src', photoUrl)
    return
  }
  if (!isDisplayablePhotoUrl(photoUrl)) return
  const fresh = createMarkerElement(place, photoUrl, orderNumbers, selected)
  el.innerHTML = fresh.innerHTML
}

type MarkerMeta = {
  orderNumbers: number[] | null
  selected: boolean
  photoUrl: string | null
}

function attachMarkerInteractions(
  el: HTMLDivElement,
  place: MapHoverPlace,
  onMarkerClick: ((id: number) => void) | undefined,
  bindMarkerHover: (el: HTMLElement, place: MapHoverPlace) => () => void,
  hoverCleanupRef: RefObject<Map<number, () => void>>,
  onDismissHover: () => void,
) {
  el.onmousedown = (ev) => {
    if (ev.button !== 0) return
    ev.stopPropagation()
    onDismissHover()
  }
  el.onclick = (ev) => {
    ev.stopPropagation()
    ev.preventDefault()
    onDismissHover()
    onMarkerClick?.(place.id)
  }
  hoverCleanupRef.current?.get(place.id)?.()
  const cleanupHover = bindMarkerHover(el, place)
  hoverCleanupRef.current?.set(place.id, cleanupHover)
}

export function MapViewGL({
  places = [],
  dayPlaces = [],
  route = null,
  routeSegments = [],
  selectedPlaceId = null,
  onMarkerClick,
  onMapClick,
  onMapContextMenu = null,
  center = [48.8566, 2.3522],
  zoom = 10,
  fitKey = 0,
  dayOrderMap = {},
  leftWidth = 0,
  rightWidth = 0,
  hasInspector = false,
  hasDayDetail = false,
  reservations = [],
  visibleConnectionIds = [],
  showReservationStats = false,
  onReservationClick,
}: Props) {
  const mapboxStyle = useSettingsStore(s => s.settings.mapbox_style || 'mapbox://styles/mapbox/standard')
  const mapboxToken = useSettingsStore(s => s.settings.mapbox_access_token || '')
  const mapbox3d = useSettingsStore(s => s.settings.mapbox_3d_enabled !== false)
  const mapboxQuality = useSettingsStore(s => s.settings.mapbox_quality_mode === true)
  const showEndpointLabels = useSettingsStore(s => s.settings.map_booking_labels) !== false
  const placesPhotosEnabled = useAuthStore(s => s.placesPhotosEnabled)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(getAllThumbs)
  const {
    hoverPreview,
    clusterHover,
    isTouchDevice,
    bindMarkerHover,
    language,
    clearAllHover,
    scheduleClusterHover,
    showClusterPicker,
    clearClusterHover,
    clusterPinnedRef,
  } = useMapPlaceHover(photoUrls)
  const markerMetaRef = useRef<Map<number, MarkerMeta>>(new Map())
  const hoverCleanupRef = useRef<Map<number, () => void>>(new Map())
  const clearAllHoverRef = useRef(clearAllHover)
  clearAllHoverRef.current = clearAllHover
  const placesByIdRef = useRef<Map<number, MapHoverPlace>>(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [zoomRev, setZoomRev] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map())
  const locationMarkerRef = useRef<LocationMarkerHandle | null>(null)
  const reservationOverlayRef = useRef<ReservationMapboxOverlay | null>(null)
  // Refs so the reservation overlay always sees the latest callback /
  // options without forcing a full overlay rebuild on every prop change.
  const onReservationClickRef = useRef(onReservationClick)
  onReservationClickRef.current = onReservationClick
  const { position: userPosition, mode: trackingMode, error: trackingError, cycleMode: cycleTrackingMode, setMode: setTrackingMode } = useGeolocation()
  const onClickRefs = useRef({ marker: onMarkerClick, map: onMapClick, context: onMapContextMenu })
  onClickRefs.current.marker = onMarkerClick
  onClickRefs.current.map = onMapClick
  onClickRefs.current.context = onMapContextMenu

  const openPlaceFromMapRef = useRef((placeId: number) => {
    const place = placesByIdRef.current.get(placeId)
    const map = mapRef.current
    if (map && place?.lat != null && place?.lng != null) {
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), MAP_MARKER_MIN_ZOOM + 0.5),
        duration: 400,
      })
    }
    onClickRefs.current.marker?.(placeId)
  })

  useEffect(() => {
    placesByIdRef.current = new Map(places.map(p => [p.id, p as MapHoverPlace]))
  }, [places])

  // Build/rebuild the map on style/token/3d change
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return
    mapboxgl.accessToken = mapboxToken

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapboxStyle,
      center: [center[1], center[0]],
      zoom,
      pitch: mapbox3d ? 45 : 0,
      attributionControl: true,
      antialias: mapboxQuality,
      projection: mapboxQuality ? 'globe' : 'mercator',
    })
    mapRef.current = map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__trek_map = map

    map.on('load', () => {
      if (mapbox3d) {
        // Terrain is only valuable on satellite styles — on clean vector
        // styles it makes route lines drift off the HTML markers because
        // the lines snap to DEM height while markers stay at sea level.
        if (!isStandardFamily(mapboxStyle) && wantsTerrain(mapboxStyle)) addTerrainAndSky(map)
        if (supportsCustom3d(mapboxStyle)) {
          const dark = document.documentElement.classList.contains('dark')
          addCustom3dBuildings(map, dark)
        }
      }

      // Mapbox Standard ships its own DEM-based terrain that kicks in
      // below zoom 13.7. HTML markers project at sea level, so when the
      // terrain exaggeration ramps up at lower zooms the markers drift
      // away from the 3D buildings and route lines they belong to. The
      // non-satellite Standard style still looks great without terrain,
      // so flatten it out to keep markers pinned. (Satellite variants
      // are left alone — the DEM is what gives them their character.)
      if (mapboxStyle === 'mapbox://styles/mapbox/standard') {
        try { map.setTerrain(null) } catch { /* noop */ }
      }
      // initial route source — kept around so updates can setData() cheaply
      if (!map.getSource('trip-route')) {
        map.addSource('trip-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        // Apple-Maps style: a darker-blue casing under a bright-blue core, both
        // rounded. Casing is added first so it sits beneath the core line.
        map.addLayer({
          id: 'trip-route-casing',
          type: 'line',
          source: 'trip-route',
          paint: { 'line-color': '#0a5cc2', 'line-width': 8 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
        map.addLayer({
          id: 'trip-route-line',
          type: 'line',
          source: 'trip-route',
          paint: { 'line-color': '#0a84ff', 'line-width': 5 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
      }
      // gpx geometries source (place.route_geometry)
      if (!map.getSource('trip-gpx')) {
        map.addSource('trip-gpx', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'trip-gpx-line',
          type: 'line',
          source: 'trip-gpx',
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#3b82f6'],
            'line-width': 3.5,
            'line-opacity': 0.75,
          },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
      }
      if (!map.getSource('trip-places-cluster')) {
        map.addSource('trip-places-cluster', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: MAP_CLUSTER_MAX_ZOOM - 1,
          clusterRadius: MAP_CLUSTER_RADIUS,
          clusterMinPoints: MAP_CLUSTER_MIN_POINTS,
        })
        map.addLayer({
          id: 'trip-clusters',
          type: 'circle',
          source: 'trip-places-cluster',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#6366f1',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 26],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        })
        map.addLayer({
          id: 'trip-cluster-count',
          type: 'symbol',
          source: 'trip-places-cluster',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        })
      }
      // Signal that sources/layers are attached so overlay effects can
      // safely add their own sources. Style rebuilds reset this via the
      // cleanup below.
      setMapReady(true)
    })

    map.on('click', (e) => {
      const t = e.originalEvent.target as HTMLElement
      if (t.closest('.mapboxgl-marker')) return
      if (t.closest('[data-testid="map-cluster-hover-preview"]')) return
      clearAllHoverRef.current()
      onClickRefs.current.map?.({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } })
    })
    let zoomRaf = 0
    const bumpZoomRev = () => {
      if (zoomRaf) cancelAnimationFrame(zoomRaf)
      zoomRaf = requestAnimationFrame(() => setZoomRev(z => z + 1))
    }
    map.on('zoom', bumpZoomRev)
    map.on('zoomend', bumpZoomRev)
    // In the mapbox-gl map the right mouse button is reserved for the
    // built-in rotate/pitch gesture, so we bind the "add place" action
    // to the middle mouse button (button === 1) instead.
    const canvas = map.getCanvasContainer()
    const onAuxDown = (ev: MouseEvent) => {
      if (ev.button !== 1) return
      ev.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const lngLat = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top])
      onClickRefs.current.context?.({
        latlng: { lat: lngLat.lat, lng: lngLat.lng },
        originalEvent: ev,
      })
    }
    // Also suppress the browser's native auxclick menu on middle-click.
    const onAuxClick = (ev: MouseEvent) => {
      if (ev.button === 1) ev.preventDefault()
    }
    canvas.addEventListener('mousedown', onAuxDown)
    canvas.addEventListener('auxclick', onAuxClick)

    // Drop follow mode if the user pans the map manually — matches the
    // Apple Maps behaviour where the blue dot stays but the map no longer
    // chases it until the user taps the button again.
    map.on('dragstart', () => {
      setTrackingMode(prev => prev === 'follow' ? 'show' : prev)
    })

    // Keep HTML markers glued to the terrain / 3D ground. Mapbox projects
    // HTML markers at altitude=0 (sea level) by default, so as soon as the
    // style has a terrain DEM (Standard, Standard Satellite, custom terrain)
    // the markers drift off the places when the camera pitches or zooms —
    // the buildings rise from DEM height, the marker stays at sea level,
    // and the pixel offset grows as the perspective changes.
    //
    // Pushing `[lng, lat, elevation]` through setLngLat tells mapbox to
    // project the marker onto the same ground the route line sits on.
    // We re-apply this every render because DEM tiles stream in async.
    let lastAltUpdate = 0
    const syncMarkerAltitudes = () => {
      const now = performance.now()
      if (now - lastAltUpdate < 80) return // ~12Hz is plenty
      lastAltUpdate = now
      markersRef.current.forEach(marker => {
        const ll = marker.getLngLat()
        let alt = 0
        try {
          const e = map.queryTerrainElevation([ll.lng, ll.lat])
          if (typeof e === 'number' && Number.isFinite(e)) alt = e
        } catch { /* terrain not ready */ }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const curAlt = (ll as any).alt ?? 0
        if (Math.abs(curAlt - alt) > 0.25) {
          marker.setLngLat([ll.lng, ll.lat, alt])
        }
      })
    }
    map.on('render', syncMarkerAltitudes)

    return () => {
      canvas.removeEventListener('mousedown', onAuxDown)
      canvas.removeEventListener('auxclick', onAuxClick)
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
      if (reservationOverlayRef.current) {
        reservationOverlayRef.current.destroy()
        reservationOverlayRef.current = null
      }
      if (locationMarkerRef.current) {
        locationMarkerRef.current.destroy()
        locationMarkerRef.current = null
      }
      try { map.remove() } catch { /* noop */ }
      mapRef.current = null
      setMapReady(false)
    }
  }, [mapboxStyle, mapboxToken, mapbox3d]) // rebuild on style changes only

  // Photo loading — mirrors the Leaflet MapView. Updates via RAF to batch
  // simultaneous thumb arrivals into one re-render.
  const pendingThumbsRef = useRef<Record<string, string>>({})
  const thumbRafRef = useRef<number | null>(null)
  const placeIds = useMemo(() => places.map(p => p.id).join(','), [places])
  useEffect(() => {
    if (!places || places.length === 0 || !placesPhotosEnabled) return
    const cleanups: (() => void)[] = []

    const setThumb = (cacheKey: string, thumb: string) => {
      pendingThumbsRef.current[cacheKey] = thumb
      if (thumbRafRef.current !== null) return
      thumbRafRef.current = requestAnimationFrame(() => {
        thumbRafRef.current = null
        const pending = pendingThumbsRef.current
        pendingThumbsRef.current = {}
        setPhotoUrls(prev => {
          const hasChange = Object.entries(pending).some(([k, v]) => prev[k] !== v)
          return hasChange ? { ...prev, ...pending } : prev
        })
      })
    }

    for (const place of places) {
      const cacheKey = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
      if (!cacheKey) continue
      const cached = getCached(cacheKey)
      const thumb = displayPhotoSrc(cached)
      if (thumb) {
        setThumb(cacheKey, thumb)
        continue
      }
      cleanups.push(onThumbReady(cacheKey, t => setThumb(cacheKey, t)))
      if (!cached && !isLoading(cacheKey)) {
        const photoId = placePhotoFetchId(place)
        if (photoId || (place.lat && place.lng)) {
          fetchPhoto(cacheKey, photoId || `coords:${place.lat}:${place.lng}`, place.lat, place.lng, place.name)
        }
      }
    }

    return () => {
      cleanups.forEach(fn => fn())
      if (thumbRafRef.current !== null) {
        cancelAnimationFrame(thumbRafRef.current)
        thumbRafRef.current = null
      }
    }
  }, [placeIds, placesPhotosEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cluster geojson + layer visibility (zoom < MAP_MARKER_MIN_ZOOM → clusters)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const src = map.getSource('trip-places-cluster') as mapboxgl.GeoJSONSource | undefined
    src?.setData(placesToClusterGeoJSON(places))
    const showClusters = map.getZoom() < MAP_MARKER_MIN_ZOOM
    const vis = showClusters ? 'visible' : 'none'
    if (map.getLayer('trip-clusters')) map.setLayoutProperty('trip-clusters', 'visibility', vis)
    if (map.getLayer('trip-cluster-count')) map.setLayoutProperty('trip-cluster-count', 'visibility', vis)
  }, [places, mapReady, zoomRev])

  const scheduleClusterHoverRef = useRef(scheduleClusterHover)
  const showClusterPickerRef = useRef(showClusterPicker)
  const clearClusterHoverRef = useRef(clearClusterHover)
  const lastClusterPlacesRef = useRef<MapHoverPlace[]>([])
  const clusterHoverGenRef = useRef(0)
  scheduleClusterHoverRef.current = scheduleClusterHover
  showClusterPickerRef.current = showClusterPicker
  clearClusterHoverRef.current = clearClusterHover

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isTouchDevice) return

    const loadClusterPlaces = (
      clusterId: number,
      cb: (places: MapHoverPlace[]) => void,
    ) => {
      const source = map.getSource('trip-places-cluster') as mapboxgl.GeoJSONSource
      source.getClusterLeaves(clusterId, 50, 0, (err, leaves) => {
        if (err || !leaves?.length) return
        const clusterPlaces: MapHoverPlace[] = []
        for (const leaf of leaves) {
          const id = leaf.properties?.placeId as number | undefined
          if (id == null) continue
          const place = placesByIdRef.current.get(id)
          if (place) clusterPlaces.push(place)
        }
        if (clusterPlaces.length > 0) cb(clusterPlaces)
      })
    }

    const onClusterClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      e.preventDefault()
      e.originalEvent?.stopPropagation()
      clusterHoverGenRef.current += 1
      const features = map.queryRenderedFeatures(e.point, { layers: ['trip-clusters', 'trip-cluster-count'] })
      const clusterId = features[0]?.properties?.cluster_id as number | undefined
      if (clusterId == null) return
      const source = map.getSource('trip-places-cluster') as mapboxgl.GeoJSONSource
      source.getClusterLeaves(clusterId, 100, 0, (err, leaves) => {
        if (err || !leaves?.length) return
        const clusterPlaces: MapHoverPlace[] = []
        for (const leaf of leaves) {
          const id = leaf.properties?.placeId as number | undefined
          if (id == null) continue
          const place = placesByIdRef.current.get(id)
          if (place) clusterPlaces.push(place)
        }
        if (clusterPlaces.length === 0) return
        showClusterPickerRef.current(
          clusterPlaces,
          e.originalEvent.clientX,
          e.originalEvent.clientY,
        )
        const bounds = new mapboxgl.LngLatBounds()
        for (const leaf of leaves) {
          const c = (leaf.geometry as GeoJSON.Point).coordinates as [number, number]
          bounds.extend(c)
        }
        const targetZoom = clusterPlaces.length <= 12
          ? MAP_CLUSTER_MAX_ZOOM + 1
          : Math.max(map.getZoom() + 1.5, MAP_MARKER_MIN_ZOOM)
        map.flyTo({
          center: bounds.getCenter(),
          zoom: Math.min(targetZoom, MAP_CLUSTER_MAX_ZOOM + 1),
          duration: 450,
        })
      })
    }

    const onClusterEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const clusterId = e.features?.[0]?.properties?.cluster_id as number | undefined
      if (clusterId == null) return
      map.getCanvas().style.cursor = 'pointer'
      const gen = ++clusterHoverGenRef.current
      loadClusterPlaces(clusterId, clusterPlaces => {
        if (gen !== clusterHoverGenRef.current) return
        lastClusterPlacesRef.current = clusterPlaces
        scheduleClusterHoverRef.current(clusterPlaces, e.originalEvent.clientX, e.originalEvent.clientY)
      })
    }

    const onClusterMove = (e: mapboxgl.MapMouseEvent) => {
      if (lastClusterPlacesRef.current.length === 0) return
      scheduleClusterHoverRef.current(
        lastClusterPlacesRef.current,
        e.originalEvent.clientX,
        e.originalEvent.clientY,
      )
    }

    const onClusterLeave = () => {
      map.getCanvas().style.cursor = ''
      lastClusterPlacesRef.current = []
      if (!clusterPinnedRef.current) clearClusterHoverRef.current()
    }

    map.on('click', 'trip-clusters', onClusterClick)
    map.on('click', 'trip-cluster-count', onClusterClick)
    map.on('mouseenter', 'trip-clusters', onClusterEnter)
    map.on('mousemove', 'trip-clusters', onClusterMove)
    map.on('mouseleave', 'trip-clusters', onClusterLeave)

    return () => {
      map.off('click', 'trip-clusters', onClusterClick)
      map.off('click', 'trip-cluster-count', onClusterClick)
      map.off('mouseenter', 'trip-clusters', onClusterEnter)
      map.off('mousemove', 'trip-clusters', onClusterMove)
      map.off('mouseleave', 'trip-clusters', onClusterLeave)
      map.getCanvas().style.cursor = ''
    }
  }, [mapReady, isTouchDevice])

  // Reconcile markers when places / selection / order badges change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (map.getZoom() < MAP_MARKER_MIN_ZOOM) {
      markersRef.current.forEach((marker, id) => {
        hoverCleanupRef.current.get(id)?.()
        hoverCleanupRef.current.delete(id)
        marker.remove()
        markersRef.current.delete(id)
        markerMetaRef.current.delete(id)
      })
      return
    }

    const ids = new Set(places.map(p => p.id))

    markersRef.current.forEach((marker, id) => {
      if (!ids.has(id)) {
        hoverCleanupRef.current.get(id)?.()
        hoverCleanupRef.current.delete(id)
        markerMetaRef.current.delete(id)
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    places.forEach(place => {
      if (!place.lat || !place.lng) return
      const hoverPlace = place as MapHoverPlace
      const orderNumbers = dayOrderMap[place.id] ?? null
      const pck = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
      const photoUrl = (pck && photoUrls[pck]) || null
      const selected = place.id === selectedPlaceId
      const meta: MarkerMeta = { orderNumbers, selected, photoUrl }
      const prev = markerMetaRef.current.get(place.id)

      const existing = markersRef.current.get(place.id)
      const structureChanged = !prev
        || prev.selected !== selected
        || JSON.stringify(prev.orderNumbers) !== JSON.stringify(orderNumbers)

      if (existing && !structureChanged) {
        markerMetaRef.current.set(place.id, meta)
        const el = existing.getElement()
        if (el && prev.photoUrl !== photoUrl) {
          applyMarkerPhoto(
            el,
            place as Place & { category_color?: string; category_icon?: string },
            photoUrl,
            orderNumbers,
            selected,
          )
        }
        return
      }

      const el = createMarkerElement(
        place as Place & { category_color?: string; category_icon?: string },
        photoUrl,
        orderNumbers,
        selected,
      )
      attachMarkerInteractions(el, hoverPlace, id => openPlaceFromMapRef.current(id), bindMarkerHover, hoverCleanupRef, () => clearAllHoverRef.current())
      if (existing) existing.remove()
      const m = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
      markersRef.current.set(place.id, m)
      markerMetaRef.current.set(place.id, meta)
    })
  }, [places, selectedPlaceId, dayOrderMap, bindMarkerHover, zoomRev]) // eslint-disable-line react-hooks/exhaustive-deps

  // Photo thumbs arriving async — patch marker images without rebuilding markers.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const meta = markerMetaRef.current.get(id)
      if (!meta) return
      const place = places.find(p => p.id === id)
      if (!place) return
      const pck = place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
      const photoUrl = (pck && photoUrls[pck]) || null
      if (photoUrl === meta.photoUrl) return
      const el = marker.getElement()
      if (!el) return
      applyMarkerPhoto(
        el,
        place as Place & { category_color?: string; category_icon?: string },
        photoUrl,
        meta.orderNumbers,
        meta.selected,
      )
      markerMetaRef.current.set(id, { ...meta, photoUrl })
    })
  }, [photoUrls, places])

  // Update route geojson
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('trip-route') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const features = (route || []).filter(seg => seg && seg.length > 1).map(seg => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: seg.map(([lat, lng]) => [lng, lat]) },
    }))
    src.setData({ type: 'FeatureCollection', features })
  }, [route])

  // Travel times now live in the day sidebar (per-segment connectors), not on the map.

  // Update GPX geometries
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('trip-gpx') as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const features = places.flatMap(place => {
      if (!place.route_geometry) return []
      try {
        const coords = JSON.parse(place.route_geometry) as [number, number][]
        if (!coords || coords.length < 2) return []
        return [{
          type: 'Feature' as const,
          properties: { color: (place as Place & { category_color?: string }).category_color || '#3b82f6' },
          geometry: { type: 'LineString' as const, coordinates: coords.map(([lat, lng]) => [lng, lat]) },
        }]
      } catch { return [] }
    })
    src.setData({ type: 'FeatureCollection', features })
  }, [places])

  // Reservation overlay — mirrors the Leaflet ReservationOverlay: great-
  // circle arcs for flights/cruises, straight lines for trains/cars,
  // clickable endpoint badges, rotating mid-arc stats label for flights.
  // The overlay is a small imperative manager that owns its own source,
  // layer, and HTML markers; it lives next to the map for the map's
  // lifetime and is rebuilt when the style/token/3d effect rebuilds.
  //
  // `visibleConnectionIds` is driven by the per-reservation toggle in
  // DayPlanSidebar — nothing is rendered until the user enables a
  // booking's route, matching the Leaflet MapView's behaviour.
  const visibleReservations = useMemo(() => {
    if (!visibleConnectionIds || visibleConnectionIds.length === 0) return []
    const set = new Set(visibleConnectionIds)
    return reservations.filter(r => set.has(r.id))
  }, [reservations, visibleConnectionIds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!reservationOverlayRef.current) {
      reservationOverlayRef.current = new ReservationMapboxOverlay(map, {
        showConnections: true,
        showStats: showReservationStats,
        showEndpointLabels,
        onEndpointClick: (id) => onReservationClickRef.current?.(id),
      })
    }
    reservationOverlayRef.current.update(visibleReservations, {
      showConnections: true,
      showStats: showReservationStats,
      showEndpointLabels,
      onEndpointClick: (id) => onReservationClickRef.current?.(id),
    })
  }, [visibleReservations, showReservationStats, showEndpointLabels, mapReady])

  // Fit bounds on fitKey change — matches the Leaflet BoundsController
  const paddingOpts = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) return { top: 40, right: 20, bottom: 40, left: 20 }
    const top = 60
    const bottom = hasInspector ? 320 : hasDayDetail ? 280 : 60
    return { top, right: rightWidth + 40, bottom, left: leftWidth + 40 }
  }, [leftWidth, rightWidth, hasInspector, hasDayDetail])

  const prevFitKey = useRef(-1)
  useEffect(() => {
    if (fitKey === prevFitKey.current) return
    prevFitKey.current = fitKey
    const map = mapRef.current
    if (!map) return
    const target = dayPlaces.length > 0 ? dayPlaces : places
    const valid = target.filter(p => p.lat && p.lng)
    if (valid.length === 0) return
    const bounds = new mapboxgl.LngLatBounds()
    valid.forEach(p => bounds.extend([p.lng, p.lat]))
    const run = () => {
      try {
        map.fitBounds(bounds, {
          padding: paddingOpts,
          maxZoom: 15,
          pitch: mapbox3d ? 45 : 0,
          duration: 400,
        })
      } catch { /* noop */ }
    }
    if (map.loaded()) run()
    else map.once('load', run)
  }, [fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // flyTo selected place
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedPlaceId) return
    const target = places.find(p => p.id === selectedPlaceId) || dayPlaces.find(p => p.id === selectedPlaceId)
    if (!target?.lat || !target?.lng) return
    try {
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: Math.max(map.getZoom(), 14),
        pitch: mapbox3d ? 45 : 0,
        duration: 400,
      })
    } catch { /* noop */ }
  }, [selectedPlaceId, mapbox3d]) // eslint-disable-line react-hooks/exhaustive-deps

  // External center/zoom prop changes — jump without animation
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try { map.jumpTo({ center: [center[1], center[0]], zoom }) } catch { /* noop */ }
  }, [center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps

  // Blue dot rendering + follow-mode camera. Attach the marker lazily the
  // first time a fix arrives so the layers sit on top of everything else
  // added so far, and destroy it when tracking is turned off.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (trackingMode === 'off') {
      if (locationMarkerRef.current) {
        locationMarkerRef.current.update(null)
      }
      return
    }
    if (!userPosition) return
    const apply = () => {
      if (!locationMarkerRef.current) locationMarkerRef.current = attachLocationMarker(map)
      locationMarkerRef.current.update(userPosition)
      if (trackingMode === 'follow') {
        // easeTo is gentler than flyTo for continuous updates
        try {
          map.easeTo({
            center: [userPosition.lng, userPosition.lat],
            bearing: userPosition.heading ?? map.getBearing(),
            zoom: Math.max(map.getZoom(), 16),
            duration: 350,
          })
        } catch { /* noop */ }
      }
    }
    if (map.loaded()) apply()
    else map.once('load', apply)
  }, [userPosition, trackingMode])

  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-center px-6">
        <div className="text-sm text-zinc-500">
          No Mapbox access token configured.<br />
          <span className="text-xs">Settings → Map → Mapbox GL</span>
        </div>
      </div>
    )
  }

  // Desktop browsers only get IP-based geolocation (city-level accuracy),
  // so the button would be misleading. Mobile, where real GPS lives, keeps it.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const buttonBottom = 'calc(var(--bottom-nav-h, 84px) + 12px)'

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {isMobile && (
        <LocationButton
          mode={trackingMode}
          error={trackingError}
          onClick={cycleTrackingMode}
          bottomOffset={buttonBottom as unknown as number}
        />
      )}
      {hoverPreview && !isTouchDevice && (
        <MapPlaceHoverPreview
          place={hoverPreview.place}
          photoUrl={hoverPreview.photoUrl}
          x={hoverPreview.x}
          y={hoverPreview.y}
          language={language}
        />
      )}
      {clusterHover && !isTouchDevice && (
        <MapPlaceClusterHoverPreview
          places={clusterHover.places}
          x={clusterHover.x}
          y={clusterHover.y}
          onPlaceClick={(id) => {
            const place = placesByIdRef.current.get(id)
            const map = mapRef.current
            if (map && place?.lat != null && place?.lng != null) {
              map.flyTo({
                center: [place.lng, place.lat],
                zoom: Math.max(map.getZoom(), MAP_MARKER_MIN_ZOOM + 0.5),
                duration: 400,
              })
            }
            clearAllHover()
            openPlaceFromMapRef.current(id)
          }}
        />
      )}
    </div>
  )
}
