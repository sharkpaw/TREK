import { describe, it, expect } from 'vitest'
import type mapboxgl from 'mapbox-gl'
import { resolveVisiblePlaceMarkers } from './mapboxHtmlClusters'
import type { Place } from '../../types'

function mockMap(opts: {
  zoom?: number
  hasSource?: boolean
  styleLoaded?: boolean
  unclustered?: number[]
  clusters?: number[]
}) {
  const {
    zoom = 10,
    hasSource = true,
    styleLoaded = true,
    unclustered = [],
    clusters = [],
  } = opts
  return {
    getZoom: () => zoom,
    isStyleLoaded: () => styleLoaded,
    getSource: (id: string) => (hasSource && id === 'trip-places-cluster' ? {} : null),
    querySourceFeatures: (_id: string, q: { filter?: unknown }) => {
      const filter = q.filter as unknown[]
      const wantsCluster = Array.isArray(filter) && (filter[1] as unknown[])?.[0] === 'point_count'
      if (wantsCluster) {
        return clusters.map((clusterId, i) => ({
          properties: { cluster_id: clusterId, point_count: 3 },
          geometry: { type: 'Point', coordinates: [2 + i, 48 + i] },
        }))
      }
      return unclustered.map((placeId, i) => ({
        properties: { placeId },
        geometry: { type: 'Point', coordinates: [2 + i, 48 + i] },
      }))
    },
  } as unknown as mapboxgl.Map
}

const places = [
  { id: 1, lat: 48.1, lng: 2.1 },
  { id: 2, lat: 48.2, lng: 2.2 },
] as Place[]

describe('resolveVisiblePlaceMarkers', () => {
  it('returns all markers when cluster source is not ready yet', () => {
    const map = mockMap({ hasSource: false })
    expect(resolveVisiblePlaceMarkers(map, places, null)).toEqual({ mode: 'all' })
  })

  it('returns all markers while cluster index is still empty', () => {
    const map = mockMap({ unclustered: [], clusters: [] })
    expect(resolveVisiblePlaceMarkers(map, places, null)).toEqual({ mode: 'all' })
  })

  it('returns partial markers for unclustered places once index is warm', () => {
    const map = mockMap({ unclustered: [1], clusters: [42] })
    const result = resolveVisiblePlaceMarkers(map, places, null)
    expect(result.mode).toBe('partial')
    if (result.mode === 'partial') {
      expect(result.positions.has(1)).toBe(true)
      expect(result.positions.has(2)).toBe(false)
    }
  })
})
