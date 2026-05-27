import PlaceAvatar from '../shared/PlaceAvatar'
import { getCategoryIcon } from '../shared/categoryIcons'
import { useTranslation } from '../../i18n'
import type { MapHoverPlace } from './useMapPlaceHover'

const ROW_H = 52
const MAX_VISIBLE = 5

interface MapPlaceClusterHoverPreviewProps {
  places: MapHoverPlace[]
  x: number
  y: number
  onPlaceClick?: (placeId: number) => void
}

export default function MapPlaceClusterHoverPreview({
  places,
  x,
  y,
  onPlaceClick,
}: MapPlaceClusterHoverPreviewProps) {
  const { t } = useTranslation()
  const cardW = 300
  const left = Math.min(x + 16, typeof window !== 'undefined' ? window.innerWidth - cardW - 12 : x + 16)
  const top = Math.max(12, y - 8)
  const listMaxH = MAX_VISIBLE * ROW_H

  return (
    <div
      data-testid="map-cluster-hover-preview"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 10000,
        pointerEvents: 'auto',
        width: cardW,
        background: 'var(--bg-elevated, #fff)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
        animation: 'mapHoverPreviewIn 0.2s ease',
      }}
    >
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted, #6b7280)',
      }}>
        {t('places.clusterHoverCount', { count: places.length })}
        {onPlaceClick && (
          <span style={{ fontWeight: 400, opacity: 0.75 }}> · {t('places.clusterHoverHint')}</span>
        )}
      </div>
      <div style={{ maxHeight: listMaxH, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {places.map(place => {
          const CatIcon = place.category_icon ? getCategoryIcon(place.category_icon) : null
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onPlaceClick?.(place.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                minHeight: ROW_H,
                padding: '6px 12px',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                background: 'transparent',
                cursor: onPlaceClick ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <PlaceAvatar place={place} size={36} category={place.category_color ? { color: place.category_color, icon: place.category_icon ?? undefined } : null} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'var(--text-primary, #111827)',
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {place.name}
                </div>
                {place.category_name && CatIcon && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <CatIcon size={10} style={{ color: place.category_color || '#6b7280', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)' }}>{place.category_name}</span>
                  </div>
                )}
                {place.address && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-faint, #9ca3af)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {place.address}
                  </div>
                )}
              </div>
            </button>
          )
        })}
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
