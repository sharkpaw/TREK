import type { Place } from '../../types'

/** Leaflet `disableClusteringAtZoom` — individual pins from this zoom up. */
export const MAP_CLUSTER_MAX_ZOOM = 17
/** Mapbox GL: same threshold as Leaflet for HTML place markers. */
export const MAP_MARKER_MIN_ZOOM = MAP_CLUSTER_MAX_ZOOM
/** Mapbox `clusterMaxZoom` — last zoom that may still form clusters. */
export const MAP_CLUSTER_SOURCE_MAX_ZOOM = MAP_CLUSTER_MAX_ZOOM - 1
/** Default cluster merge radius in px (Mapbox `clusterRadius`). */
export const MAP_CLUSTER_RADIUS = 100
/** Mapbox: minimum points to form a cluster (Leaflet default is 2). */
export const MAP_CLUSTER_MIN_POINTS = 2

export function shouldShowMapClusters(zoom: number): boolean {
  return zoom < MAP_CLUSTER_MAX_ZOOM
}

export function shouldShowMapMarkers(zoom: number): boolean {
  return zoom >= MAP_CLUSTER_MAX_ZOOM
}

/** Leaflet: radius scales down near uncluster zoom so pins separate cleanly. */
export function clusterRadiusForZoom(zoom: number): number {
  if (zoom >= MAP_CLUSTER_MAX_ZOOM - 1) return 40
  if (zoom >= MAP_CLUSTER_MAX_ZOOM - 4) return 75
  return MAP_CLUSTER_RADIUS
}

/** Leaflet `clusterIconCreateFunction` sizes. */
export function clusterIconSize(count: number): number {
  return count < 10 ? 36 : count < 50 ? 42 : 48
}

export function createClusterMarkerElement(count: number): HTMLDivElement {
  const size = clusterIconSize(count)
  const wrap = document.createElement('div')
  wrap.className = 'marker-cluster-wrapper'
  wrap.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`
  wrap.innerHTML = `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px;"><span>${count}</span></div>`
  return wrap
}

export function updateClusterMarkerElement(el: HTMLElement, count: number): void {
  const size = clusterIconSize(count)
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  const inner = el.querySelector('.marker-cluster-custom') as HTMLElement | null
  if (inner) {
    inner.style.width = `${size}px`
    inner.style.height = `${size}px`
  }
  const span = el.querySelector('.marker-cluster-custom span')
  if (span) span.textContent = String(count)
}

/** Leaflet `spiderfyOnMaxZoom` — ring offsets in lng/lat around center. */
export function spiderfyLngLatPositions(
  count: number,
  centerLng: number,
  centerLat: number,
  radiusMeters = 32,
): [number, number][] {
  const positions: [number, number][] = []
  const latRad = (centerLat * Math.PI) / 180
  const cosLat = Math.cos(latRad) || 1e-6
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const dLng = (radiusMeters * Math.cos(angle)) / (111320 * cosLat)
    const dLat = (radiusMeters * Math.sin(angle)) / 110540
    positions.push([centerLng + dLng, centerLat + dLat])
  }
  return positions
}

export function placesToClusterGeoJSON(
  places: Place[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []
  for (const p of places) {
    if (p.lat == null || p.lng == null) continue
    features.push({
      type: 'Feature',
      properties: { placeId: p.id },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}
