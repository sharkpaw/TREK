import type { Place } from '../../types'

/**
 * Zoom >= MAP_MARKER_MIN_ZOOM → individual HTML pins (PlaceInspector on click).
 * Zoom < MAP_MARKER_MIN_ZOOM → Mapbox cluster bubbles only.
 * MAP_CLUSTER_SOURCE_MAX_ZOOM must be one below MAP_MARKER_MIN_ZOOM so unclustered
 * GeoJSON points are never invisible between cluster layer and HTML markers.
 */
export const MAP_MARKER_MIN_ZOOM = 13
/** Mapbox `clusterMaxZoom` — last zoom level that may still form clusters. */
export const MAP_CLUSTER_SOURCE_MAX_ZOOM = MAP_MARKER_MIN_ZOOM - 1
/** Leaflet: keep grouping until user zooms in further. */
export const MAP_CLUSTER_MAX_ZOOM = 17
/** Default cluster merge radius in px (Mapbox `clusterRadius`). */
export const MAP_CLUSTER_RADIUS = 100
/** Mapbox: minimum points required to form a cluster (reduces tiny pairs). */
export const MAP_CLUSTER_MIN_POINTS = 3

export function shouldShowMapClusters(zoom: number): boolean {
  return zoom < MAP_MARKER_MIN_ZOOM
}

export function shouldShowMapMarkers(zoom: number): boolean {
  return zoom >= MAP_MARKER_MIN_ZOOM
}

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
