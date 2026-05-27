import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import TagMultiSelectDropdown from './TagMultiSelectDropdown'
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

export function TagChips({ tags }: { tags: Tag[] }) {
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
            padding: '2px 8px', borderRadius: 99,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: tag.color || 'var(--text-faint)', flexShrink: 0,
          }} />
          {tag.name}
        </span>
      ))}
    </div>
  )
}

export default function PlaceTagsEditor({ allTags, selectedIds, onChange, onCreateTag, compact }: PlaceTagsEditorProps) {
  const { t } = useTranslation()
  const addTag = useTripStore(s => s.addTag)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

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
      <div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          }}
        >
          <Plus size={12} /> {t('places.addFirstTag')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {selectedTags.length > 0 && <TagChips tags={selectedTags} />}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TagMultiSelectDropdown
            tags={allTags}
            selectedIds={selectedSet}
            onToggle={toggle}
            onClear={() => onChange([])}
            emptyLabelKey="places.formTagsPlaceholder"
            selectedLabelKey="places.tagsSelected"
            style={{ marginTop: 0 }}
          />
        </div>
        {!showNew ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            title={t('places.createTag')}
            style={{
              width: 30, height: 30, flexShrink: 0, borderRadius: 8,
              border: '1px solid var(--border-primary)', background: 'var(--bg-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-faint)',
            }}
          >
            <Plus size={14} />
          </button>
        ) : null}
      </div>
      {showNew && (
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
