import type { Place } from '../../types'

/**
 * Individual markers appear at zoom >= this level.
 * Higher value = stay grouped longer while zooming in (fewer tiny clusters).
 */
export const MAP_CLUSTER_MAX_ZOOM = 15
/** Larger radius merges more points per cluster (Leaflet `maxClusterRadius`). */
export const MAP_CLUSTER_RADIUS = 62

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
