import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, Search } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useTripStore } from '../../store/tripStore'
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
  const addTag = useTripStore(s => s.addTag)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const trimmedSearch = search.trim()

  const filtered = useMemo(() => {
    const q = trimmedSearch.toLowerCase()
    if (!q) return tags
    return tags.filter(tag => tag.name.toLowerCase().includes(q))
  }, [tags, trimmedSearch])

  const exactMatchExists = useMemo(
    () => trimmedSearch.length > 0 && tags.some(t => t.name.toLowerCase() === trimmedSearch.toLowerCase()),
    [tags, trimmedSearch],
  )

  const showCreateOption = trimmedSearch.length > 0 && !exactMatchExists

  const handleCreate = useCallback(async () => {
    if (!trimmedSearch || creating || exactMatchExists) return
    setCreating(true)
    try {
      const tag = await addTag({ name: trimmedSearch })
      onToggle(String(tag.id))
      setSearch('')
    } catch {
      /* toast in store */
    } finally {
      setCreating(false)
    }
  }, [trimmedSearch, creating, exactMatchExists, addTag, onToggle])

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
      if (e.key === 'Enter' && showCreateOption && !creating) {
        e.preventDefault()
        void handleCreate()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchorEl, onClose, showCreateOption, creating, handleCreate])

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
        {showCreateOption && (
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: creating ? 'wait' : 'pointer',
              background: 'var(--bg-hover)', fontFamily: 'inherit', fontSize: 12,
              fontWeight: 600, color: 'var(--accent, #6366f1)', textAlign: 'left',
              marginBottom: filtered.length > 0 ? 4 : 0,
            }}
          >
            <Plus size={14} style={{ flexShrink: 0 }} />
            <span>{t('places.createTagFromSearch').replace('{name}', trimmedSearch)}</span>
          </button>
        )}
        {filtered.map(tag => {
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
        {!showCreateOption && filtered.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
            {t('places.noTagsYet')}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
