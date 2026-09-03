import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NetworkMap } from '../components/NetworkMap'
import { daysAgo, initials } from '../lib/format'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
import {
  color,
  contactTypeLabel,
  font,
  label,
  radius,
  stageColor,
  stageLabel,
  surfaceGradient,
  tierLabel,
} from '../lib/tokens'
import type { ContactWithScore, Stage } from '../lib/types'

type View = 'cards' | 'map'

const pipelineStages: Stage[] = ['silent', 'warming', 'contacted', 'conversation']
const PAGE_SIZE = 9

function Pill({ text, tone }: { text: string; tone: 'accent' | 'neutral' | 'outline' }) {
  const styles =
    tone === 'accent'
      ? { background: color.accent, border: `1px solid ${color.accent}`, color: color.bg }
      : tone === 'neutral'
        ? { background: 'rgba(255,255,255,.09)', border: '1px solid transparent', color: color.muted }
        : { background: 'transparent', border: `1px solid ${color.border}`, color: color.muted }

  return (
    <span
      style={{
        ...label,
        ...styles,
        padding: '4px 10px',
        borderRadius: 6,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  )
}

type StatusIconKind = 'zap' | 'clock' | 'alert'

function StatusIcon({ kind, color: iconColor }: { kind: StatusIconKind; color: string }) {
  const shared = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: iconColor,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (kind === 'zap') {
    return (
      <svg {...shared}>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    )
  }
  if (kind === 'alert') {
    return (
      <svg {...shared}>
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    )
  }
  return (
    <svg {...shared}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function ArrowButton() {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: `1px solid ${color.border}`,
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    </span>
  )
}

function touchStatus(contact: ContactWithScore): { text: string; color: string; icon: StatusIconKind } {
  const openEvents = contact.score?.open_events ?? 0
  if (openEvents > 0) {
    return {
      text: `${openEvents} new signal${openEvents === 1 ? '' : 's'}`,
      color: color.accent,
      icon: 'zap',
    }
  }
  if (!contact.last_touch_at) {
    return { text: 'No touchpoint yet', color: color.warn, icon: 'alert' }
  }
  const isStale = contact.stage === 'dormant' || contact.stage === 'silent'
  const ago = daysAgo(contact.last_touch_at)
  return isStale
    ? { text: `No touchpoint · ${ago}`, color: color.warn, icon: 'alert' }
    : { text: `Last touch ${ago}`, color: color.muted, icon: 'clock' }
}

function ContactCard({ contact }: { contact: ContactWithScore }) {
  const subtitle = [contact.role_title, contact.company].filter(Boolean).join(' · ')
  const status = touchStatus(contact)
  const isPositiveStage = contact.stage === 'contacted' || contact.stage === 'conversation'

  return (
    <Link
      to={`/contact/${contact.id}`}
      className="ns-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        background: surfaceGradient,
        border: `1px solid ${color.border}`,
        borderRadius: 12,
        textDecoration: 'none',
        color: color.text,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: color.surface,
              border: `1px solid ${color.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: font.mono,
              fontSize: 13,
              color: color.accent,
            }}
          >
            {initials(contact.name)}
          </div>
          {(contact.score?.open_events ?? 0) > 0 && (
            <span
              className="ns-pulse-dot"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color.accent,
                border: `2px solid ${color.bg}`,
              }}
            />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: font.body, fontSize: 16, fontWeight: 600 }}>
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
        {contact.score && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <span style={{ fontFamily: font.mono, fontSize: 15, color: color.accent }}>
              {contact.score.score}
            </span>
            <span style={{ ...label, fontSize: 9, color: color.dim }}>{tierLabel[contact.score.tier]}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {contact.contact_type !== 'unknown' && (
          <Pill text={contactTypeLabel[contact.contact_type].toUpperCase()} tone="outline" />
        )}
        <Pill
          text={stageLabel[contact.stage].toUpperCase()}
          tone={isPositiveStage ? 'accent' : 'neutral'}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 16,
          borderTop: `1px solid ${color.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <StatusIcon kind={status.icon} color={status.color} />
          <span
            style={{
              ...label,
              fontSize: 10.5,
              fontWeight: 700,
              color: status.color,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {status.text}
          </span>
        </div>
        <ArrowButton />
      </div>
    </Link>
  )
}

export function Network() {
  const { contacts, loading, error } = useContactsWithScore()
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('cards')
  const [page, setPage] = useState(1)
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  )

  function selectStage(s: Stage | 'all') {
    setStageFilter(s)
    setPage(1)
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600, color: color.text }}>
            Network
          </div>
          <div style={{ ...label, color: color.dim, marginTop: 4 }}>
            {counts.all} {counts.all === 1 ? 'contact' : 'contacts'}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', width: isMobile ? '100%' : undefined }}>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 10,
              width: isMobile ? '100%' : undefined,
            }}
          >
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search name or company"
              style={{
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                padding: '10px 14px',
                color: color.text,
                fontFamily: font.body,
                fontSize: 13,
                minWidth: isMobile ? undefined : 280,
                width: isMobile ? '100%' : undefined,
                outline: 'none',
              }}
            />
            {!isMobile && <ViewToggle view={view} onChange={setView} />}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChip active={stageFilter === 'all'} onClick={() => selectStage('all')} text="All" count={counts.all} />
        <FilterDivider />
        <PipelineTabs stageFilter={stageFilter} counts={counts} onSelect={selectStage} />
        <FilterDivider />
        <FilterChip
          active={stageFilter === 'dormant'}
          onClick={() => selectStage('dormant')}
          text={stageLabel.dormant}
          count={counts.dormant}
          dotColor={stageColor.dormant}
          muted
        />
      </div>

      {loading && <div style={{ ...label, color: color.muted }}>Loading…</div>}
      {error && (
        <div style={{ ...label, color: color.warn }}>
          Could not load contacts: {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ ...label, color: color.muted }}>No contacts match.</div>
      )}

      {isMobile || view === 'cards' ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: isMobile ? 16 : 24,
              maxWidth: isMobile ? undefined : 1280,
            }}
          >
            {paged.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
          )}
        </>
      ) : (
        <NetworkMap contacts={filtered} />
      )}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const pageButtonStyle = (active: boolean): CSSProperties => ({
    ...label,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    height: 30,
    padding: '0 8px',
    borderRadius: radius.sm - 2,
    border: `1px solid ${active ? color.accent : color.border}`,
    background: active ? color.accent : color.surface,
    color: active ? color.bg : color.muted,
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        style={{ ...pageButtonStyle(false), opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
      >
        ‹
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} style={pageButtonStyle(p === page)}>
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          ...pageButtonStyle(false),
          opacity: page >= totalPages ? 0.4 : 1,
          cursor: page >= totalPages ? 'default' : 'pointer',
        }}
      >
        ›
      </button>
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
            background: view === v ? 'rgba(0,255,58,.13)' : 'transparent',
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
        background: active ? 'rgba(0,255,58,.08)' : color.surface,
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
              background: active ? 'rgba(0,255,58,.13)' : 'transparent',
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
