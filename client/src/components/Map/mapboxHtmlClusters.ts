import mapboxgl from 'mapbox-gl'
import {
  MAP_CLUSTER_MAX_ZOOM,
  MAP_CLUSTER_MIN_POINTS,
  MAP_CLUSTER_SOURCE_MAX_ZOOM,
  createClusterMarkerElement,
  placesToClusterGeoJSON,
  shouldShowMapClusters,
  updateClusterMarkerElement,
} from './mapClusterConfig'
import type { Place } from '../../types'

export const CLUSTER_SOURCE_ID = 'trip-places-cluster'

export type SpiderfyState = {
  clusterId: number
  positions: Map<number, [number, number]>
}

export function ensureClusterSource(
  map: mapboxgl.Map,
  places: Place[],
  radius: number,
): void {
  const data = placesToClusterGeoJSON(places)
  if (map.getSource(CLUSTER_SOURCE_ID)) {
    const src = map.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource
    src.setData(data)
    return
  }
  map.addSource(CLUSTER_SOURCE_ID, {
    type: 'geojson',
    data,
    cluster: true,
    clusterMaxZoom: MAP_CLUSTER_SOURCE_MAX_ZOOM,
    clusterRadius: radius,
    clusterMinPoints: MAP_CLUSTER_MIN_POINTS,
  })
}

export function rebuildClusterSource(
  map: mapboxgl.Map,
  places: Place[],
  radius: number,
): void {
  if (map.getLayer('trip-clusters')) map.removeLayer('trip-clusters')
  if (map.getLayer('trip-cluster-count')) map.removeLayer('trip-cluster-count')
  if (map.getSource(CLUSTER_SOURCE_ID)) map.removeSource(CLUSTER_SOURCE_ID)
  map.addSource(CLUSTER_SOURCE_ID, {
    type: 'geojson',
    data: placesToClusterGeoJSON(places),
    cluster: true,
    clusterMaxZoom: MAP_CLUSTER_SOURCE_MAX_ZOOM,
    clusterRadius: radius,
    clusterMinPoints: MAP_CLUSTER_MIN_POINTS,
  })
}

function dedupeByClusterId(
  features: mapboxgl.MapboxGeoJSONFeature[],
): mapboxgl.MapboxGeoJSONFeature[] {
  const byId = new Map<number, mapboxgl.MapboxGeoJSONFeature>()
  for (const f of features) {
    const id = f.properties?.cluster_id as number | undefined
    if (id == null) continue
    byId.set(id, f)
  }
  return [...byId.values()]
}

export function getUnclusteredPlaceIds(map: mapboxgl.Map): Set<number> {
  const features = map.querySourceFeatures(CLUSTER_SOURCE_ID, {
    filter: ['!', ['has', 'point_count']],
  })
  const ids = new Set<number>()
  const seen = new Set<string>()
  for (const f of features) {
    const placeId = f.properties?.placeId as number | undefined
    if (placeId == null) continue
    const coords = (f.geometry as GeoJSON.Point).coordinates
    const key = `${placeId}:${coords[0]}:${coords[1]}`
    if (seen.has(key)) continue
    seen.add(key)
    ids.add(placeId)
  }
  return ids
}

export type VisiblePlaceMarker =
  | { mode: 'all' }
  | { mode: 'partial'; positions: Map<number, [number, number]> }

export function resolveVisiblePlaceMarkers(
  map: mapboxgl.Map,
  places: Place[],
  spiderfy: SpiderfyState | null,
): VisiblePlaceMarker {
  if (!shouldShowMapClusters(map.getZoom())) {
    return { mode: 'all' }
  }
  const positions = new Map<number, [number, number]>()
  if (spiderfy) {
    for (const [id, pos] of spiderfy.positions) positions.set(id, pos)
  }
  const unclustered = getUnclusteredPlaceIds(map)
  for (const place of places) {
    if (place.lat == null || place.lng == null) continue
    if (positions.has(place.id)) continue
    if (unclustered.has(place.id)) {
      positions.set(place.id, [place.lng, place.lat])
    }
  }
  return { mode: 'partial', positions }
}

export type ClusterMarkerHandlers = {
  onClick: (
    clusterId: number,
    count: number,
    center: [number, number],
    ev: MouseEvent,
  ) => void
  onMouseEnter: (clusterId: number, ev: MouseEvent) => void
  onMouseMove: (ev: MouseEvent) => void
  onMouseLeave: () => void
}

export function syncHtmlClusterMarkers(
  map: mapboxgl.Map,
  clusterMarkersRef: Map<number, mapboxgl.Marker>,
  handlers: ClusterMarkerHandlers,
): void {
  if (!shouldShowMapClusters(map.getZoom())) {
    clusterMarkersRef.forEach(m => m.remove())
    clusterMarkersRef.clear()
    return
  }

  const raw = map.querySourceFeatures(CLUSTER_SOURCE_ID, {
    filter: ['has', 'point_count'],
  })
  const features = dedupeByClusterId(raw)
  const active = new Set<number>()

  for (const f of features) {
    const clusterId = f.properties?.cluster_id as number | undefined
    const count = f.properties?.point_count as number | undefined
    if (clusterId == null || count == null) continue
    active.add(clusterId)
    const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]

    let marker = clusterMarkersRef.get(clusterId)
    if (!marker) {
      const el = createClusterMarkerElement(count)
      el.onmousedown = ev => {
        if (ev.button !== 0) return
        ev.stopPropagation()
      }
      el.onclick = ev => {
        ev.stopPropagation()
        ev.preventDefault()
        handlers.onClick(clusterId, count, coords, ev)
      }
      el.onmouseenter = ev => handlers.onMouseEnter(clusterId, ev)
      el.onmousemove = ev => handlers.onMouseMove(ev)
      el.onmouseleave = () => handlers.onMouseLeave()
      marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map)
      clusterMarkersRef.set(clusterId, marker)
    } else {
      marker.setLngLat(coords)
      const el = marker.getElement()
      if (el) updateClusterMarkerElement(el, count)
    }
  }

  clusterMarkersRef.forEach((marker, id) => {
    if (active.has(id)) return
    marker.remove()
    clusterMarkersRef.delete(id)
  })
}

export function clusterExpansionZoom(
  map: mapboxgl.Map,
  clusterId: number,
): Promise<number | null> {
  return new Promise(resolve => {
    const source = map.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!source) {
      resolve(null)
      return
    }
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || zoom == null) resolve(null)
      else resolve(zoom)
    })
  })
}

export function clusterLeaves(
  map: mapboxgl.Map,
  clusterId: number,
  limit = 100,
): Promise<mapboxgl.MapboxGeoJSONFeature[]> {
  return new Promise(resolve => {
    const source = map.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!source) {
      resolve([])
      return
    }
    source.getClusterLeaves(clusterId, limit, 0, (err, leaves) => {
      if (err || !leaves) resolve([])
      else resolve(leaves)
    })
  })
}

export function fitClusterBounds(
  map: mapboxgl.Map,
  leaves: mapboxgl.MapboxGeoJSONFeature[],
): void {
  const bounds = new mapboxgl.LngLatBounds()
  for (const leaf of leaves) {
    const c = (leaf.geometry as GeoJSON.Point).coordinates as [number, number]
    bounds.extend(c)
  }
  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: MAP_CLUSTER_MAX_ZOOM - 1,
    duration: 450,
  })
}
