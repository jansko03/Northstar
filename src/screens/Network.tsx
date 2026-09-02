import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NetworkMap } from '../components/NetworkMap'
import { initials } from '../lib/format'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
import { color, font, label, radius, stageColor, stageLabel, tierLabel } from '../lib/tokens'
import type { ContactWithScore, Stage } from '../lib/types'

type View = 'cards' | 'map'

const pipelineStages: Stage[] = ['silent', 'warming', 'contacted', 'conversation']

function ContactCard({ contact }: { contact: ContactWithScore }) {
  const subtitle = [contact.role_title, contact.company].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/contact/${contact.id}`}
      className="ns-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 272,
        padding: 18,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        textDecoration: 'none',
        color: color.text,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: color.surface,
            border: `1px solid ${color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.mono,
            fontSize: 13,
            color: color.accent,
            flexShrink: 0,
          }}
        >
          {initials(contact.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.body, fontSize: 15, fontWeight: 500 }}>
            {contact.name}
          </div>
          {subtitle && (
            <div
              style={{
                fontFamily: font.body,
                fontSize: 12.5,
                color: color.muted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {(contact.score?.open_events ?? 0) > 0 && (
          <span
            className="ns-pulse-dot"
            style={{
              marginLeft: 'auto',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color.accent,
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StageDot stage={contact.stage} />
          <span style={{ ...label, color: color.muted }}>{stageLabel[contact.stage]}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {contact.score && (
            <span style={{ ...label, color: color.dim }}>{tierLabel[contact.score.tier]}</span>
          )}
          <span style={{ fontFamily: font.mono, fontSize: 15, color: color.accent }}>
            {contact.score?.score ?? '—'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function Network() {
  const { contacts, loading, error } = useContactsWithScore()
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('cards')
  const isMobile = useIsMobile()

  const counts = useMemo(() => {
    const c: Record<Stage | 'all', number> = {
      all: contacts.length,
      silent: 0,
      warming: 0,
      contacted: 0,
      conversation: 0,
      dormant: 0,
    }
    for (const contact of contacts) c[contact.stage]++
    return c
  }, [contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q)
    })
  }, [contacts, stageFilter, search])

  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600, color: color.text }}>
            Network
          </div>
          <div style={{ ...label, color: color.dim, marginTop: 4 }}>
            {counts.all} {counts.all === 1 ? 'contact' : 'contacts'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or company"
            style={{
              background: color.surface,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              padding: '10px 14px',
              color: color.text,
              fontFamily: font.body,
              fontSize: 13,
              minWidth: isMobile ? undefined : 220,
              width: isMobile ? '100%' : undefined,
              outline: 'none',
            }}
          />
          {!isMobile && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChip
          active={stageFilter === 'all'}
          onClick={() => setStageFilter('all')}
          text="All"
          count={counts.all}
        />
        <FilterDivider />
        <PipelineTabs stageFilter={stageFilter} counts={counts} onSelect={setStageFilter} />
        <FilterDivider />
        <FilterChip
          active={stageFilter === 'dormant'}
          onClick={() => setStageFilter('dormant')}
          text={stageLabel.dormant}
          count={counts.dormant}
          dotColor={stageColor.dormant}
          muted
        />
      </div>

      {loading && <div style={{ ...label, color: color.muted }}>Loading…</div>}
      {error && (
        <div style={{ ...label, color: color.lime }}>
          Could not load contacts: {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ ...label, color: color.muted }}>No contacts match.</div>
      )}

      {isMobile || view === 'cards' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(292px, 1fr))',
            gap: 22,
          }}
        >
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      ) : (
        <NetworkMap contacts={filtered} />
      )}
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.sm,
      }}
    >
      {(['cards', 'map'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            ...label,
            padding: '6px 12px',
            borderRadius: radius.sm - 4,
            border: 'none',
            background: view === v ? 'rgba(79,227,155,.13)' : 'transparent',
            color: view === v ? color.accent : color.muted,
            cursor: 'pointer',
          }}
        >
          {v === 'cards' ? 'Cards' : 'Map'}
        </button>
      ))}
    </div>
  )
}

function FilterDivider() {
  return (
    <div
      aria-hidden
      style={{ width: 1, height: 18, background: 'rgba(255,255,255,.16)', flexShrink: 0, alignSelf: 'center' }}
    />
  )
}

function StageDot({ stage }: { stage: Stage }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: stageColor[stage],
        flexShrink: 0,
      }}
    />
  )
}

function FilterChip({
  active,
  onClick,
  text,
  count,
  muted,
  dotColor,
}: {
  active: boolean
  onClick: () => void
  text: string
  count: number
  muted?: boolean
  dotColor?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...label,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? color.accent : color.border}`,
        background: active ? 'rgba(79,227,155,.08)' : color.surface,
        color: active ? color.accent : muted ? color.dim : color.muted,
        cursor: 'pointer',
      }}
    >
      {dotColor && (
        <span
          style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }}
        />
      )}
      {text}
      <span style={{ color: active ? color.accent : color.dim }}>{count}</span>
    </button>
  )
}

function PipelineTabs({
  stageFilter,
  counts,
  onSelect,
}: {
  stageFilter: Stage | 'all'
  counts: Record<Stage | 'all', number>
  onSelect: (s: Stage) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        padding: 3,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: 999,
      }}
    >
      {pipelineStages.map((s) => {
        const active = stageFilter === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              ...label,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 11px',
              borderRadius: 999 - 3,
              border: 'none',
              background: active ? 'rgba(79,227,155,.13)' : 'transparent',
              color: active ? color.accent : color.muted,
              cursor: 'pointer',
            }}
          >
            <StageDot stage={s} />
            {stageLabel[s]}
            <span style={{ color: active ? color.accent : color.dim }}>{counts[s]}</span>
          </button>
        )
      })}
    </div>
  )
}
