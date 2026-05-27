import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Place } from '../../types'

export const MAP_HOVER_DELAY_MS = 2000

export type MapHoverPlace = Place & {
  category_name?: string | null
  category_color?: string | null
  category_icon?: string | null
}

function photoKey(place: MapHoverPlace) {
  return place.google_place_id || place.osm_id || `${place.lat},${place.lng}`
}

function resolvePhotoUrl(place: MapHoverPlace, photoUrls: Record<string, string>) {
  const pck = photoKey(place)
  return (pck && photoUrls[pck]) || place.image_url || null
}

export function useMapPlaceHover(photoUrls: Record<string, string>) {
  const { language } = useTranslation()
  const [hoverPreview, setHoverPreview] = useState<{
    place: MapHoverPlace
    x: number
    y: number
    photoUrl: string | null
  } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHoverRef = useRef<{ place: MapHoverPlace; x: number; y: number } | null>(null)
  const photoUrlsRef = useRef(photoUrls)
  photoUrlsRef.current = photoUrls

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const scheduleHoverPreview = useCallback((place: MapHoverPlace, x: number, y: number) => {
    pendingHoverRef.current = { place, x, y }
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
        photoUrl: resolvePhotoUrl(p.place, photoUrlsRef.current),
      })
    }, MAP_HOVER_DELAY_MS)
  }, [clearHoverTimer])

  const clearHoverPreview = useCallback(() => {
    pendingHoverRef.current = null
    clearHoverTimer()
    setHoverPreview(null)
  }, [clearHoverTimer])

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer])

  useEffect(() => {
    if (!hoverPreview) return
    const url = resolvePhotoUrl(hoverPreview.place, photoUrls)
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
    isTouchDevice,
    bindMarkerHover,
    clearHoverPreview,
  }
}
