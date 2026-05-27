import ReactDOM from 'react-dom'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../../i18n'

interface PlacePhotoLightboxProps {
  src: string
  alt: string
  caption?: string | null
  onClose: () => void
}

export default function PlacePhotoLightbox({ src, alt, caption, onClose }: PlacePhotoLightboxProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100010,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(24px) saturate(120%)',
        WebkitBackdropFilter: 'blur(24px) saturate(120%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        paddingBottom: 'calc(24px + var(--bottom-nav-h, 0px))',
        animation: 'placePhotoLightboxIn 0.22s ease',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.92)',
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
      >
        <X size={18} strokeWidth={2} />
      </button>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          maxWidth: 'min(960px, 100%)',
          width: '100%',
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: 'min(92vw, 960px)',
            maxHeight: 'min(78vh, 820px)',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 16,
            boxShadow: '0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
            display: 'block',
            userSelect: 'none',
          }}
          draggable={false}
        />
        {caption && (
          <p style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.82)',
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 'min(92vw, 640px)',
          }}>
            {caption}
          </p>
        )}
      </div>

      <style>{`
        @keyframes placePhotoLightboxIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
