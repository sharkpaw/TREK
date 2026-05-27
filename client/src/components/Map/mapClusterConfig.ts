import type { Place } from '../../types'

/**
 * Individual markers appear at zoom >= this level.
 * Higher value = stay grouped longer while zooming in (fewer tiny clusters).
 */
export const MAP_CLUSTER_MAX_ZOOM = 17
/** HTML markers visible at this zoom; clusters hidden below. */
export const MAP_MARKER_MIN_ZOOM = MAP_CLUSTER_MAX_ZOOM - 1
/** Default cluster merge radius in px (Mapbox `clusterRadius`). */
export const MAP_CLUSTER_RADIUS = 100
/** Mapbox: minimum points required to form a cluster (reduces tiny pairs). */
export const MAP_CLUSTER_MIN_POINTS = 3

/** Leaflet: radius scales down near uncluster zoom so pins separate cleanly. */
export function clusterRadiusForZoom(zoom: number): number {
  if (zoom >= MAP_CLUSTER_MAX_ZOOM - 1) return 40
  if (zoom >= MAP_CLUSTER_MAX_ZOOM - 4) return 75
  return MAP_CLUSTER_RADIUS
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
