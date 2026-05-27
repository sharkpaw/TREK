import React, { useState, useEffect, useRef } from 'react'
import { getCategoryIcon } from './categoryIcons'
import { getCached, isLoading, fetchPhoto, onThumbReady, displayPhotoSrc, type PhotoEntry } from '../../services/photoService'
import { isPlacePhotoBytesUrl, parsePlacePhotoProxyUrl, placePhotoFetchId } from '../../utils/placePhotoUrls'
import { useAuthStore } from '../../store/authStore'
import type { Place } from '../../types'

interface Category {
  color?: string
  icon?: string
}

interface PlaceAvatarProps {
  place: Pick<Place, 'id' | 'name' | 'image_url' | 'google_place_id' | 'osm_id' | 'lat' | 'lng'>
  size?: number
  category?: Category | null
  onPhotoClick?: (src: string) => void
}

function initialPhotoSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (isPlacePhotoBytesUrl(imageUrl)) return parsePlacePhotoProxyUrl(imageUrl)?.thumbUrl ?? null
  return imageUrl
}

function initialFullPhotoSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (isPlacePhotoBytesUrl(imageUrl)) return parsePlacePhotoProxyUrl(imageUrl)?.fullUrl ?? null
  return imageUrl
}

export default React.memo(function PlaceAvatar({ place, size = 32, category, onPhotoClick }: PlaceAvatarProps) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(() => initialPhotoSrc(place.image_url))
  const [fullPhotoSrc, setFullPhotoSrc] = useState<string | null>(() => initialFullPhotoSrc(place.image_url))
  const [visible, setVisible] = useState(false)
  const imageUrlFailed = useRef(false)
  const ref = useRef<HTMLElement>(null)
  const placesPhotosEnabled = useAuthStore(s => s.placesPhotosEnabled)

  // Observe visibility — fetch photo only when avatar enters viewport
  useEffect(() => {
    if (place.image_url) { setVisible(true); return }
    if (!placesPhotosEnabled) return
    const el = ref.current
    if (!el) return
    // Check if already cached — show immediately without waiting for intersection
    const photoId = place.google_place_id || place.osm_id
    const cacheKey = photoId || `${place.lat},${place.lng}`
    if (cacheKey && getCached(cacheKey)) { setVisible(true); return }

    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [place.id])

  const applyPhotoEntry = (entry: PhotoEntry) => {
    setPhotoSrc(displayPhotoSrc(entry))
    if (entry?.photoUrl) setFullPhotoSrc(entry.photoUrl)
  }

  useEffect(() => {
    if (!visible) return
    if (place.image_url) {
      setPhotoSrc(initialPhotoSrc(place.image_url))
      setFullPhotoSrc(initialFullPhotoSrc(place.image_url))
      return
    }
    if (!placesPhotosEnabled) return
    const photoId = place.google_place_id || place.osm_id
    if (!photoId && !(place.lat && place.lng)) { setPhotoSrc(null); return }

    const cacheKey = photoId || `${place.lat},${place.lng}`

    const cached = getCached(cacheKey)
    if (cached) {
      applyPhotoEntry(cached)
      if (!displayPhotoSrc(cached)) {
        return onThumbReady(cacheKey, thumb => setPhotoSrc(thumb))
      }
      return
    }

    if (isLoading(cacheKey)) {
      return onThumbReady(cacheKey, thumb => setPhotoSrc(thumb))
    }

    fetchPhoto(cacheKey, photoId || `coords:${place.lat}:${place.lng}`, place.lat, place.lng, place.name, applyPhotoEntry)
    return onThumbReady(cacheKey, thumb => setPhotoSrc(thumb))
  }, [visible, place.id, place.image_url, place.google_place_id, place.osm_id])

  const bgColor = category?.color || '#6366f1'
  const IconComp = getCategoryIcon(category?.icon)
  const iconSize = Math.round(size * 0.46)

  const containerStyle: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: bgColor,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const clickable = !!(onPhotoClick && fullPhotoSrc)

  if (photoSrc) {
    const image = (
      <img
        src={photoSrc}
        alt={place.name}
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => {
          if (!imageUrlFailed.current && photoSrc === place.image_url && (place.google_place_id || place.osm_id)) {
            imageUrlFailed.current = true
            const photoId = place.google_place_id || place.osm_id!
            const cacheKey = `refetch:${photoId}`
            fetchPhoto(cacheKey, photoId, place.lat ?? undefined, place.lng ?? undefined, place.name, applyPhotoEntry)
          } else {
            setPhotoSrc(null)
            setFullPhotoSrc(null)
          }
        }}
      />
    )

    if (clickable) {
      return (
        <button
          ref={ref as React.RefObject<HTMLButtonElement>}
          type="button"
          aria-label={place.name}
          onClick={() => onPhotoClick!(fullPhotoSrc!)}
          style={{
            ...containerStyle,
            border: 'none',
            padding: 0,
            cursor: 'zoom-in',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {image}
        </button>
      )
    }

    return (
      <div ref={ref} style={containerStyle}>
        {image}
      </div>
    )
  }

  return (
    <div ref={ref} style={containerStyle}>
      <IconComp size={iconSize} strokeWidth={1.8} color="rgba(255,255,255,0.92)" />
    </div>
  )
})
