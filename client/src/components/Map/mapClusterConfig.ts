import type { Place } from '../../types'

/** Matches Leaflet MarkerClusterGroup `disableClusteringAtZoom` */
export const MAP_CLUSTER_MAX_ZOOM = 11
export const MAP_CLUSTER_RADIUS = 30

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
