import { useState, type CSSProperties } from 'react'
import { Search, X, Users } from 'lucide-react'
import Modal from '../shared/Modal'
import { CustomDatePicker } from '../shared/CustomDateTimePicker'
import type { TripMember } from '../../types'

const VISIBLE_MEMBERS = 4
const DATE_WIDTH = 108

interface BudgetFiltersBarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  search: string
  onSearchChange: (v: string) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  memberId: string
  payerId: string
  onMemberIdChange: (v: string) => void
  onPayerIdChange: (v: string) => void
  tripMembers: TripMember[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  filteredCount: number
  totalCount: number
}

function PersonAvatar({ member, size = 32 }: { member: TripMember; size?: number }) {
  const initial = member.username?.[0]?.toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size < 28 ? 10 : 12, fontWeight: 600, color: 'var(--text-secondary)',
    }}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial}
    </div>
  )
}

interface PersonPickerModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  members: TripMember[]
  value: string
  onChange: (id: string) => void
  allLabel: string
}

function PersonPickerModal({ isOpen, onClose, title, members, value, onChange, allLabel }: PersonPickerModalProps) {
  const select = (id: string) => {
    onChange(id)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, padding: '4px 0 8px' }}>
        <button
          type="button"
          onClick={() => select('')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '12px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            border: !value ? '2px solid var(--accent)' : '1px solid var(--border-primary)',
            background: !value ? 'var(--bg-hover)' : 'var(--bg-card)',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
          }}>
            <Users size={20} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>{allLabel}</span>
        </button>
        {members.map(m => {
          const selected = value === String(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => select(String(m.id))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '12px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border-primary)',
                background: selected ? 'var(--bg-hover)' : 'var(--bg-card)',
              }}
            >
              <PersonAvatar member={m} size={44} />
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
              }}>
                {m.username}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

interface PersonFilterStripProps {
  label: string
  modalTitle: string
  allLabel: string
  selectLabel: string
  value: string
  onChange: (v: string) => void
  members: TripMember[]
}

function PersonFilterStrip({ label, modalTitle, allLabel, selectLabel, value, onChange, members }: PersonFilterStripProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const visible = members.slice(0, VISIBLE_MEMBERS)
  const hiddenCount = Math.max(0, members.length - VISIBLE_MEMBERS)

  const chipStyle = (active: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: active ? '3px 10px 3px 3px' : '3px 8px 3px 3px',
    borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    border: active ? '2px solid var(--accent)' : '1px solid var(--border-primary)',
    background: active ? 'var(--bg-hover)' : 'var(--bg-card)',
    maxWidth: 120,
  })

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 auto' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <button type="button" onClick={() => onChange('')} style={chipStyle(!value)} title={allLabel}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Users size={12} color="var(--text-faint)" />
            </div>
            {!value && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{allLabel}</span>}
          </button>
          {visible.map(m => {
            const active = value === String(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(active ? '' : String(m.id))}
                style={chipStyle(active)}
                title={m.username}
              >
                <PersonAvatar member={m} size={26} />
                {active && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.username}
                  </span>
                )}
              </button>
            )
          })}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                ...chipStyle(false),
                padding: '3px 10px',
                fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
              }}
            >
              +{hiddenCount}
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              appearance: 'none', border: '1px dashed var(--border-primary)', borderRadius: 999,
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
              padding: '5px 10px', flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            {selectLabel}
          </button>
        </div>
      </div>
      <PersonPickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        members={members}
        value={value}
        onChange={onChange}
        allLabel={allLabel}
      />
    </>
  )
}

export default function BudgetFiltersBar({
  t,
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  memberId,
  payerId,
  onMemberIdChange,
  onPayerIdChange,
  tripMembers,
  hasActiveFilters,
  onClearFilters,
  filteredCount,
  totalCount,
}: BudgetFiltersBarProps) {
  const dateStyle: CSSProperties = { width: DATE_WIDTH, maxWidth: DATE_WIDTH, flexShrink: 0 }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Mobile: search row */}
      <div className="md:hidden" style={{ marginBottom: 8, position: 'relative' }}>
        <Search size={14} strokeWidth={1.8} color="var(--text-faint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('budget.searchPlaceholder')}
          aria-label={t('budget.searchPlaceholder')}
          style={{
            width: '100%', padding: '9px 34px', borderRadius: 10,
            border: '1px solid var(--border-primary)', background: 'var(--bg-card)', fontSize: 13,
            color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        {search && (
          <button type="button" onClick={() => onSearchChange('')} aria-label={t('budget.clearFilters')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={14} strokeWidth={2} color="var(--text-faint)" />
          </button>
        )}
      </div>

      {/* Desktop: single row / Mobile: filter row */}
      <div
        className="flex flex-col md:flex-row md:flex-nowrap md:items-end gap-2 md:gap-2"
        style={{ minWidth: 0 }}
      >
        {/* Desktop search */}
        <div className="hidden md:block" style={{ position: 'relative', flex: '1 1 160px', minWidth: 120, maxWidth: 220 }}>
          <Search size={14} strokeWidth={1.8} color="var(--text-faint)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('budget.searchPlaceholder')}
            aria-label={t('budget.searchPlaceholder')}
            style={{
              width: '100%', padding: '7px 30px 7px 30px', borderRadius: 10,
              border: '1px solid var(--border-primary)', background: 'var(--bg-card)', fontSize: 12,
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button type="button" onClick={() => onSearchChange('')} aria-label={t('budget.clearFilters')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={12} strokeWidth={2} color="var(--text-faint)" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <CustomDatePicker value={dateFrom} onChange={onDateFromChange} placeholder={t('budget.dateFrom')} compact style={dateStyle} />
          <span style={{ color: 'var(--text-faint)', fontSize: 11, flexShrink: 0 }}>—</span>
          <CustomDatePicker value={dateTo} onChange={onDateToChange} placeholder={t('budget.dateTo')} compact style={dateStyle} />
        </div>

        {tripMembers.length > 0 && (
          <>
            <PersonFilterStrip
              label={t('budget.filterMember')}
              modalTitle={t('budget.filterMember')}
              allLabel={t('budget.filterAllMembers')}
              selectLabel={t('budget.selectPerson')}
              value={memberId}
              onChange={onMemberIdChange}
              members={tripMembers}
            />
            <PersonFilterStrip
              label={t('budget.filterPayer')}
              modalTitle={t('budget.filterPayer')}
              allLabel={t('budget.filterAllPayers')}
              selectLabel={t('budget.selectPerson')}
              value={payerId}
              onChange={onPayerIdChange}
              members={tripMembers}
            />
          </>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="max-md:!w-full"
            style={{
              appearance: 'none', border: '1px solid var(--border-primary)', borderRadius: 10,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 11, fontWeight: 500, padding: '7px 10px', flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {t('budget.clearFilters')}
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {t('budget.filterResults', { count: filteredCount, total: totalCount })}
        </div>
      )}
    </div>
  )
}
