import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search } from 'lucide-react'
import { getCategoryIcon } from './categoryIcons'
import { useTranslation } from '../../i18n'
import type { Category } from '../../types'

interface CategoryPickerPopoverProps {
  categories: Category[]
  selectedId: number | null | undefined
  onSelect: (categoryId: number | null) => void
  onClose: () => void
  anchorEl: HTMLElement | null
}

export default function CategoryPickerPopover({
  categories,
  selectedId,
  onSelect,
  onClose,
  anchorEl,
}: CategoryPickerPopoverProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(c => c.name.toLowerCase().includes(q))
  }, [categories, search])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorEl?.contains(target)) return
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
      aria-label={t('places.formCategory')}
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
            placeholder={t('places.searchCategory')}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: 4 }}>
        <button
          type="button"
          onClick={() => { onSelect(null); onClose() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: selectedId == null ? 'var(--bg-hover)' : 'transparent',
            fontFamily: 'inherit', fontSize: 12, color: 'var(--text-muted)', textAlign: 'left',
          }}
        >
          {t('places.noCategory')}
        </button>
        {filtered.map(cat => {
          const active = selectedId === cat.id
          const CatIcon = getCategoryIcon(cat.icon)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => { onSelect(cat.id); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'var(--bg-hover)' : 'transparent',
                fontFamily: 'inherit', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left',
              }}
            >
              <CatIcon size={14} style={{ color: cat.color || '#6b7280', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cat.name}</span>
              {active && <Check size={14} style={{ color: 'var(--accent)' }} />}
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
