import { mapsApi } from '../api/client'
import {
  parsePlacePhotoProxyUrl,
  thumbUrlFromFullPhotoUrl,
} from '../utils/placePhotoUrls'

// Shared photo cache — used by PlaceAvatar (sidebar) and MapView (map markers)
export interface PhotoEntry {
  /** Full-size proxy URL — lightbox / hover preview only */
  photoUrl: string | null
  /** Server-generated small JPEG — avatars and map markers */
  thumbUrl: string | null
  /** Base64 thumb for external URLs (Wikimedia etc.) */
  thumbDataUrl: string | null
}

const cache = new Map<string, PhotoEntry>()
const inFlight = new Set<string>()
const listeners = new Map<string, Set<(entry: PhotoEntry) => void>>()
// Called when a display-sized image becomes available (thumbUrl or thumbDataUrl)
const thumbListeners = new Map<string, Set<(thumb: string) => void>>()

// Concurrency limiter — at most N photo API requests in flight at once.
const MAX_CONCURRENT = 5
let activeRequests = 0
const requestQueue: Array<() => void> = []

function acquireRequestSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise(resolve => requestQueue.push(resolve))
}

function releaseRequestSlot(): void {
  const next = requestQueue.shift()
  if (next) {
    next()
  } else {
    activeRequests--
  }
}

function notify(key: string, entry: PhotoEntry) {
  listeners.get(key)?.forEach(fn => fn(entry))
  listeners.delete(key)
}

function notifyThumb(key: string, thumb: string) {
  thumbListeners.get(key)?.forEach(fn => fn(thumb))
  thumbListeners.delete(key)
}

/** URL suitable for small UI (avatar, map marker) */
export function displayPhotoSrc(entry: PhotoEntry | null | undefined): string | null {
  if (!entry) return null
  return entry.thumbDataUrl || entry.thumbUrl || null
}

export function onPhotoLoaded(key: string, fn: (entry: PhotoEntry) => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(fn)
  return () => { listeners.get(key)?.delete(fn) }
}

export function onThumbReady(key: string, fn: (thumb: string) => void): () => void {
  if (!thumbListeners.has(key)) thumbListeners.set(key, new Set())
  thumbListeners.get(key)!.add(fn)
  return () => { thumbListeners.get(key)?.delete(fn) }
}

export function getCached(key: string): PhotoEntry | undefined {
  return cache.get(key)
}

export function isLoading(key: string): boolean {
  return inFlight.has(key)
}

function applyThumbToEntry(cacheKey: string, entry: PhotoEntry, thumb: string) {
  if (thumb.startsWith('data:')) entry.thumbDataUrl = thumb
  else entry.thumbUrl = thumb
  notifyThumb(cacheKey, thumb)
}

// Convert image URL to base64 via canvas — only for external URLs without a server thumb
export function urlToBase64(url: string, size: number = 48): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - s) / 2
        const sy = (img.naturalHeight - s) / 2
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/webp', 0.6))
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function storeEntry(cacheKey: string, entry: PhotoEntry, callback?: (entry: PhotoEntry) => void) {
  cache.set(cacheKey, entry)
  callback?.(entry)
  notify(cacheKey, entry)
  const display = displayPhotoSrc(entry)
  if (display) notifyThumb(cacheKey, display)
}

export function fetchPhoto(
  cacheKey: string,
  photoId: string,
  lat?: number,
  lng?: number,
  name?: string,
  callback?: (entry: PhotoEntry) => void
) {
  const cached = cache.get(cacheKey)
  if (cached) { callback?.(cached); return }

  if (inFlight.has(cacheKey)) {
    if (callback) onPhotoLoaded(cacheKey, callback)
    return
  }

  // Stable proxy URL from DB — resolve full + thumb without API round-trip
  const proxy = photoId.startsWith('/api/maps/place-photo/')
    ? parsePlacePhotoProxyUrl(photoId.replace(/\/bytes$/, '').replace(/\/thumb$/, ''))
    : null
  if (proxy) {
    const entry: PhotoEntry = {
      photoUrl: proxy.fullUrl,
      thumbUrl: proxy.thumbUrl,
      thumbDataUrl: null,
    }
    storeEntry(cacheKey, entry, callback)
    return
  }

  inFlight.add(cacheKey)
  acquireRequestSlot().then(() =>
    mapsApi.placePhoto(photoId, lat, lng, name)
      .then(async (data: { photoUrl?: string; thumbUrl?: string }) => {
        const photoUrl = data.photoUrl || null
        if (!photoUrl) {
          storeEntry(cacheKey, { photoUrl: null, thumbUrl: null, thumbDataUrl: null }, callback)
          return
        }

        const thumbUrl = data.thumbUrl || thumbUrlFromFullPhotoUrl(photoUrl)
        const entry: PhotoEntry = { photoUrl, thumbUrl, thumbDataUrl: null }
        storeEntry(cacheKey, entry, callback)

        // External URLs: generate a tiny base64 thumb client-side
        if (!thumbUrl && !photoUrl.includes('/api/maps/place-photo/')) {
          const thumb = await urlToBase64(photoUrl)
          if (thumb) applyThumbToEntry(cacheKey, entry, thumb)
        }
      })
      .catch(() => {
        storeEntry(cacheKey, { photoUrl: null, thumbUrl: null, thumbDataUrl: null }, callback)
      })
      .finally(() => { inFlight.delete(cacheKey); releaseRequestSlot() })
  )
}

export function getAllThumbs(): Record<string, string> {
  const r: Record<string, string> = {}
  for (const [k, v] of cache.entries()) {
    const src = displayPhotoSrc(v)
    if (src) r[k] = src
  }
  return r
}
