import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n'
import { getCached } from '../../services/photoService'
import { parsePlacePhotoProxyUrl, ensureFullPlacePhotoUrl } from '../../utils/placePhotoUrls'
import type { Place } from '../../types'

export const MAP_HOVER_DELAY_MS = 1300

export type MapHoverPlace = Place & {
  category_name?: string | null
  category_color?: string | null
  category_icon?: string | null
}

function photoKey(place: MapHoverPlace) {
  return place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
}

/** Hover card — full cached image (never the /thumb variant) */
function resolveHoverFullPhoto(place: MapHoverPlace): string | null {
  const pck = photoKey(place)
  const cached = pck ? getCached(pck) : undefined
  if (cached?.photoUrl) return ensureFullPlacePhotoUrl(cached.photoUrl)
  if (place.image_url) {
    const parsed = parsePlacePhotoProxyUrl(place.image_url)
    if (parsed) return parsed.fullUrl
    if (!place.image_url.includes('/api/maps/place-photo/')) return place.image_url
  }
  return null
}

function prefetchHoverPhoto(url: string) {
  if (typeof Image === 'undefined') return
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function useMapPlaceHover(photoUrls: Record<string, string>) {
  const { language } = useTranslation()
  const [hoverPreview, setHoverPreview] = useState<{
    place: MapHoverPlace
    x: number
    y: number
    photoUrl: string | null
  } | null>(null)
  const [clusterHover, setClusterHover] = useState<{
    places: MapHoverPlace[]
    x: number
    y: number
  } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clusterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHoverRef = useRef<{ place: MapHoverPlace; x: number; y: number } | null>(null)
  const pendingClusterRef = useRef<{ places: MapHoverPlace[]; x: number; y: number } | null>(null)
  const photoUrlsRef = useRef(photoUrls)
  photoUrlsRef.current = photoUrls

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const clearClusterTimer = useCallback(() => {
    if (clusterTimerRef.current) {
      clearTimeout(clusterTimerRef.current)
      clusterTimerRef.current = null
    }
  }, [])

  const clearHoverPreview = useCallback(() => {
    pendingHoverRef.current = null
    clearHoverTimer()
    setHoverPreview(null)
  }, [clearHoverTimer])

  const clearClusterHover = useCallback(() => {
    pendingClusterRef.current = null
    clearClusterTimer()
    setClusterHover(null)
  }, [clearClusterTimer])

  const clearAllHover = useCallback(() => {
    clearHoverPreview()
    clearClusterHover()
  }, [clearHoverPreview, clearClusterHover])

  const scheduleHoverPreview = useCallback((place: MapHoverPlace, x: number, y: number) => {
    clearClusterHover()
    pendingHoverRef.current = { place, x, y }
    const preload = resolveHoverFullPhoto(place)
    if (preload) prefetchHoverPhoto(preload)
    setHoverPreview(prev => (prev?.place?.id === place.id ? { ...prev, x, y } : prev))
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      const p = pendingHoverRef.current
      if (!p || p.place.id !== place.id) return
      setHoverPreview({
        place: p.place,
        x: p.x,
        y: p.y,
        photoUrl: resolveHoverFullPhoto(p.place),
      })
    }, MAP_HOVER_DELAY_MS)
  }, [clearHoverTimer, clearClusterHover])

  const scheduleClusterHover = useCallback((places: MapHoverPlace[], x: number, y: number) => {
    if (places.length === 0) return
    clearHoverPreview()
    pendingClusterRef.current = { places, x, y }
    setClusterHover(prev => (
      prev && prev.places.length === places.length && prev.places[0]?.id === places[0]?.id
        ? { ...prev, x, y }
        : prev
    ))
    clearClusterTimer()
    clusterTimerRef.current = setTimeout(() => {
      clusterTimerRef.current = null
      const p = pendingClusterRef.current
      if (!p) return
      setClusterHover({ places: p.places, x: p.x, y: p.y })
    }, MAP_HOVER_DELAY_MS)
  }, [clearClusterTimer, clearHoverPreview])

  useEffect(() => () => {
    clearHoverTimer()
    clearClusterTimer()
  }, [clearHoverTimer, clearClusterTimer])

  // Dismiss preview on any pointer down outside the cluster list (sidebar, map, markers).
  useEffect(() => {
    if (!hoverPreview && !clusterHover) return
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement
      if (t.closest('[data-testid="map-cluster-hover-preview"]')) return
      clearAllHover()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [hoverPreview, clusterHover, clearAllHover])

  useEffect(() => {
    if (!hoverPreview) return
    const url = resolveHoverFullPhoto(hoverPreview.place)
    if (url && url !== hoverPreview.photoUrl) {
      setHoverPreview(prev => (prev ? { ...prev, photoUrl: url } : prev))
    }
  }, [photoUrls, hoverPreview])

  const bindMarkerHover = useCallback((el: HTMLElement, place: MapHoverPlace) => {
    const onEnter = (ev: MouseEvent) => scheduleHoverPreview(place, ev.clientX, ev.clientY)
    const onMove = (ev: MouseEvent) => scheduleHoverPreview(place, ev.clientX, ev.clientY)
    const onLeave = () => clearHoverPreview()
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [scheduleHoverPreview, clearHoverPreview])

  const isTouchDevice = typeof window !== 'undefined' && navigator.maxTouchPoints > 0

  return {
    language,
    hoverPreview,
    clusterHover,
    isTouchDevice,
    bindMarkerHover,
    clearHoverPreview,
    clearClusterHover,
    clearAllHover,
    scheduleClusterHover,
    scheduleHoverPreview,
  }
}
