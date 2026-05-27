import { useEffect, useState } from 'react'
import { MapPin, Star, Clock } from 'lucide-react'
import { mapsApi } from '../../api/client'
import { getCategoryIcon } from '../shared/categoryIcons'
import { TagChips } from '../shared/PlaceTagsEditor'
import { useTranslation } from '../../i18n'
import type { Tag } from '../../types'

interface MapPlaceHoverPreviewProps {
  place: {
    id: number
    name: string
    address?: string | null
    category_name?: string | null
    category_color?: string | null
    category_icon?: string | null
    google_place_id?: string | null
    osm_id?: string | null
    tags?: Tag[]
  }
  photoUrl: string | null
  x: number
  y: number
  language: string
}

export default function MapPlaceHoverPreview({ place, photoUrl, x, y, language }: MapPlaceHoverPreviewProps) {
  const { t } = useTranslation()
  const [details, setDetails] = useState<{ open_now?: boolean | null; rating?: number } | null>(null)
  const detailId = place.google_place_id || place.osm_id

  useEffect(() => {
    if (!detailId) { setDetails(null); return }
    let cancelled = false
    mapsApi.details(detailId, language).then(data => {
      if (!cancelled) setDetails({ open_now: data.place?.open_now, rating: data.place?.rating })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [detailId, language])

  const CatIcon = place.category_icon ? getCategoryIcon(place.category_icon) : null
  const openNow = details?.open_now

  const cardW = 260
  const left = Math.min(x + 16, typeof window !== 'undefined' ? window.innerWidth - cardW - 12 : x + 16)
  const top = Math.max(12, y - 8)

  return (
    <div
      data-testid="map-place-hover-preview"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 10000,
        pointerEvents: 'none',
        width: cardW,
        background: 'var(--bg-elevated, #fff)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        animation: 'mapHoverPreviewIn 0.2s ease',
      }}
    >
      {photoUrl && (
        <div style={{ width: '100%', height: 120, background: 'var(--bg-tertiary, #e5e7eb)' }}>
          <img
            src={photoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            draggable={false}
          />
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary, #111827)', lineHeight: 1.3 }}>
          {place.name}
        </div>
        {place.category_name && CatIcon && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <CatIcon size={11} style={{ color: place.category_color || '#6b7280', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>{place.category_name}</span>
          </div>
        )}
        {place.tags && place.tags.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <TagChips tags={place.tags} />
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
          {openNow !== null && openNow !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
              background: openNow ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
              color: openNow ? '#16a34a' : '#dc2626',
            }}>
              {openNow ? t('inspector.opened') : t('inspector.closed')}
            </span>
          )}
          {details?.rating != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-muted)' }}>
              <Star size={10} fill="#facc15" color="#facc15" />
              {details.rating.toFixed(1)}
            </span>
          )}
        </div>
        {place.address && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 6 }}>
            <MapPin size={10} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{
              fontSize: 11, color: 'var(--text-faint, #9ca3af)', lineHeight: 1.35,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {place.address}
            </span>
          </div>
        )}
        {!photoUrl && !place.category_name && openNow == null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--text-faint)' }}>
            <Clock size={10} />
            <span>{t('places.mapHoverHint')}</span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes mapHoverPreviewIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
