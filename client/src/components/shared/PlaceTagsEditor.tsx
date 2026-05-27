import { forwardRef, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import TagPickerPopover from './TagPickerPopover'
import { useTranslation } from '../../i18n'
import { useTripStore } from '../../store/tripStore'
import type { Tag } from '../../types'

interface PlaceTagsEditorProps {
  allTags: Tag[]
  selectedIds: number[]
  onChange: (tagIds: number[]) => void
  onCreateTag?: (tag: Tag) => void
  compact?: boolean
}

export function TagChips({
  tags,
  onRemove,
}: {
  tags: Tag[]
  onRemove?: (tagId: number) => void
}) {
  if (!tags?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map(tag => (
        <span
          key={tag.id}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 500,
            color: tag.color || 'var(--text-muted)',
            background: tag.color ? `${tag.color}18` : 'var(--bg-hover)',
            border: `1px solid ${tag.color ? `${tag.color}35` : 'var(--border-faint)'}`,
            padding: onRemove ? '2px 4px 2px 8px' : '2px 8px', borderRadius: 99,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: tag.color || 'var(--text-faint)', flexShrink: 0,
          }} />
          {tag.name}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(tag.id)}
              aria-label="remove"
              style={{
                width: 16, height: 16, borderRadius: '50%', border: 'none',
                background: 'transparent', cursor: 'pointer', padding: 0,
                color: 'var(--text-faint)', fontSize: 14, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

export const AddChipButton = forwardRef<HTMLButtonElement, { onClick: () => void; title?: string }>(
function AddChipButton({ onClick, title }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, flexShrink: 0, borderRadius: 99,
        border: '1px dashed var(--border-primary)', background: 'var(--bg-card)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-muted)',
      }}
    >
      <Plus size={14} />
    </button>
  )
})

export default function PlaceTagsEditor({ allTags, selectedIds, onChange, onCreateTag, compact }: PlaceTagsEditorProps) {
  const { t } = useTranslation()
  const addTag = useTripStore(s => s.addTag)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds])
  const selectedTags = useMemo(
    () => allTags.filter(t => selectedIds.includes(t.id)),
    [allTags, selectedIds],
  )

  const toggle = (id: string) => {
    const num = Number(id)
    if (selectedIds.includes(num)) onChange(selectedIds.filter(x => x !== num))
    else onChange([...selectedIds, num])
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const tag = await addTag({ name })
      onCreateTag?.(tag)
      onChange([...selectedIds, tag.id])
      setNewName('')
      setShowNew(false)
    } catch {
      /* toast handled in store */
    } finally {
      setCreating(false)
    }
  }

  if (allTags.length === 0 && !showNew) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <AddChipButton onClick={() => setShowNew(true)} title={t('places.addFirstTag')} />
        {showNew && (
          <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('places.tagNamePlaceholder')}
              className="form-input"
              style={{ flex: 1, fontSize: 12 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
            />
            <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()}
              className="bg-slate-900 text-white px-3 rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50">
              OK
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <TagChips tags={selectedTags} onRemove={id => onChange(selectedIds.filter(x => x !== id))} />
        <AddChipButton
          ref={addBtnRef}
          onClick={() => setPickerOpen(true)}
          title={t('places.formTags')}
        />
      </div>
      {pickerOpen && (
        <TagPickerPopover
          tags={allTags}
          selectedIds={selectedSet}
          onToggle={toggle}
          onClose={() => setPickerOpen(false)}
          anchorEl={addBtnRef.current}
        />
      )}
      {!showNew ? (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          }}
        >
          <Plus size={11} /> {t('places.createTag')}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('places.tagNamePlaceholder')}
            className="form-input"
            style={{ flex: 1, fontSize: 12 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
          />
          <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()}
            className="bg-slate-900 text-white px-3 rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50">
            OK
          </button>
          <button type="button" onClick={() => { setShowNew(false); setNewName('') }}
            className="text-gray-500 px-2 text-sm">
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
