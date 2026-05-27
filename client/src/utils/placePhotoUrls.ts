/** Google place photo proxy paths served by TREK API */
const PROXY_RE = /^\/api\/maps\/place-photo\/([^/]+)(?:\/(bytes|thumb))?$/

export function isPlacePhotoBytesUrl(url: string | null | undefined): boolean {
  return !!url && url.includes('/api/maps/place-photo/') && url.endsWith('/bytes')
}

export function parsePlacePhotoProxyUrl(url: string): {
  placeId: string
  fullUrl: string
  thumbUrl: string
} | null {
  const m = url.match(PROXY_RE)
  if (!m) return null
  const placeId = decodeURIComponent(m[1])
  const enc = encodeURIComponent(placeId)
  return {
    placeId,
    fullUrl: `/api/maps/place-photo/${enc}/bytes`,
    thumbUrl: `/api/maps/place-photo/${enc}/thumb`,
  }
}

/** Hover / lightbox must never use the 96px thumb endpoint */
export function ensureFullPlacePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.endsWith('/thumb')) return url.replace(/\/thumb$/, '/bytes')
  const parsed = parsePlacePhotoProxyUrl(url)
  if (parsed) return parsed.fullUrl
  return url
}

export function thumbUrlFromFullPhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null
  if (photoUrl.endsWith('/thumb')) return photoUrl
  if (photoUrl.endsWith('/bytes')) return photoUrl.replace(/\/bytes$/, '/thumb')
  const parsed = parsePlacePhotoProxyUrl(photoUrl)
  return parsed?.thumbUrl ?? null
}

/** ID passed to mapsApi.placePhoto — never a /bytes proxy path */
export function placePhotoFetchId(place: {
  google_place_id?: string | null
  osm_id?: string | null
  image_url?: string | null
}): string | null {
  if (place.google_place_id) return place.google_place_id
  if (place.osm_id) return place.osm_id
  if (place.image_url?.startsWith('/api/maps/place-photo/')) {
    const parsed = parsePlacePhotoProxyUrl(place.image_url)
    if (parsed) return parsed.placeId
  }
  return null
}
