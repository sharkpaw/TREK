import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { Tag } from '../../types'

interface TagMultiSelectDropdownProps {
  tags: Tag[]
  selectedIds: Set<string>
  onToggle: (tagId: string) => void
  onClear?: () => void
  emptyLabelKey?: string
  selectedLabelKey?: string
  style?: React.CSSProperties
}

export default function TagMultiSelectDropdown({
  tags,
  selectedIds,
  onToggle,
  onClear,
  emptyLabelKey = 'places.allTags',
  selectedLabelKey = 'places.tagsSelected',
  style,
}: TagMultiSelectDropdownProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (tags.length === 0) return null

  const label = selectedIds.size === 0
    ? t(emptyLabelKey)
    : selectedIds.size === 1
      ? (tags.find(tag => selectedIds.has(String(tag.id)))?.name || t(emptyLabelKey))
      : `${selectedIds.size} ${t(selectedLabelKey)}`

  return (
    <div ref={ref} style={{ marginTop: 6, position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-primary)',
          background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-primary)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, maxHeight: 200, overflowY: 'auto',
        }}>
          {tags.map(tag => {
            const active = selectedIds.has(String(tag.id))
            const dotColor = tag.color || 'var(--accent)'
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(String(tag.id))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
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
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: dotColor,
                }} />
                <span style={{ flex: 1 }}>{tag.name}</span>
              </button>
            )
          })}
          {selectedIds.size > 0 && onClear && (
            <button
              type="button"
              onClick={() => { onClear(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit', fontSize: 11, color: 'var(--text-faint)',
                marginTop: 2, borderTop: '1px solid var(--border-faint)',
              }}
            >
              <X size={10} /> {t('places.clearTagFilter')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
