import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { Tag } from '../../types'

interface TagPickerPopoverProps {
  tags: Tag[]
  selectedIds: Set<string>
  onToggle: (tagId: string) => void
  onClose: () => void
  anchorEl: HTMLElement | null
}

export default function TagPickerPopover({
  tags,
  selectedIds,
  onToggle,
  onClose,
  anchorEl,
}: TagPickerPopoverProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tags
    return tags.filter(tag => tag.name.toLowerCase().includes(q))
  }, [tags, search])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorEl?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchorEl, onClose])

  const rect = anchorEl?.getBoundingClientRect()
  if (!rect) return null

  const panelW = 260
  const left = Math.min(rect.left, window.innerWidth - panelW - 8)
  const top = rect.bottom + 6

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('places.formTags')}
      style={{
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 10050,
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-faint)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 8px', borderRadius: 8,
          background: 'var(--bg-hover)', border: '1px solid var(--border-faint)',
        }}>
          <Search size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('places.searchTags')}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
            {t('places.noTagsMatch')}
          </div>
        ) : filtered.map(tag => {
          const active = selectedIds.has(String(tag.id))
          const dotColor = tag.color || 'var(--accent)'
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(String(tag.id))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'var(--bg-hover)' : 'transparent',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: active ? 'none' : '1.5px solid var(--border-primary)',
                background: active ? dotColor : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <Check size={10} strokeWidth={3} color="white" />}
              </div>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor,
              }} />
              <span style={{ flex: 1 }}>{tag.name}</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
