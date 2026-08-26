import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { initials } from '../lib/format'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { color, font, label, radius, stageColor, stageLabel, tierLabel } from '../lib/tokens'
import type { ContactWithScore, Stage } from '../lib/types'

const stages: Stage[] = ['silent', 'warming', 'contacted', 'conversation', 'dormant']

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
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: stageColor[contact.stage],
              flexShrink: 0,
            }}
          />
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
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterChip
            active={stageFilter === 'all'}
            onClick={() => setStageFilter('all')}
            text="All"
            count={counts.all}
          />
          {stages.map((s) => (
            <FilterChip
              key={s}
              active={stageFilter === s}
              onClick={() => setStageFilter(s)}
              text={stageLabel[s]}
              count={counts[s]}
            />
          ))}
        </div>
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
            minWidth: 220,
            outline: 'none',
          }}
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))',
          gap: 14,
        }}
      >
        {filtered.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  text,
  count,
}: {
  active: boolean
  onClick: () => void
  text: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...label,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? color.accent : color.border}`,
        background: active ? 'rgba(79,227,155,.08)' : color.surface,
        color: active ? color.accent : color.muted,
        cursor: 'pointer',
      }}
    >
      {text}
      <span style={{ color: active ? color.accent : color.dim }}>{count}</span>
    </button>
  )
}
