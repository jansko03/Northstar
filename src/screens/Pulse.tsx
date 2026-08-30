import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SignalRow } from '../components/SignalRow'
import { Section } from '../components/Section'
import { daysAgo, initials } from '../lib/format'
import { supabase, DEFAULT_USER_ID } from '../lib/supabase'
import { cardShadow, color, font, kindLabel, label, radius, surfaceGradient } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
import type { SignalKind, SignalWithContact } from '../lib/types'

const actionableKinds = ['job_change', 'funding', 'post_intent'] as const

export function Pulse() {
  const [openSignals, setOpenSignals] = useState<SignalWithContact[]>([])
  const [weekSignals, setWeekSignals] = useState<SignalWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isMobile = useIsMobile()

  async function load() {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

    const [openRes, weekRes] = await Promise.all([
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', DEFAULT_USER_ID)
        .is('handled_at', null)
        .in('kind', actionableKinds)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', DEFAULT_USER_ID)
        .gte('occurred_at', weekAgo)
        .order('occurred_at', { ascending: false }),
    ])

    if (openRes.error) {
      setError(openRes.error.message)
      setLoading(false)
      return
    }
    if (weekRes.error) {
      setError(weekRes.error.message)
      setLoading(false)
      return
    }

    setOpenSignals(openRes.data as unknown as SignalWithContact[])
    setWeekSignals(weekRes.data as unknown as SignalWithContact[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function markHandled(signalId: string) {
    const signal = openSignals.find((s) => s.id === signalId)
    setOpenSignals((prev) => prev.filter((s) => s.id !== signalId))
    setActionError(null)

    const { error: updateError } = await supabase
      .from('signal')
      .update({ handled_at: new Date().toISOString() })
      .eq('id', signalId)

    if (updateError && signal) {
      setOpenSignals((prev) => [...prev, signal].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)))
      setActionError(`Could not mark "${signal.contact.name}" handled: ${updateError.message}`)
    }
  }

  const columns = useMemo(
    () => ({
      job_change: openSignals.filter((s) => s.kind === 'job_change'),
      funding: openSignals.filter((s) => s.kind === 'funding'),
      post_intent: openSignals.filter((s) => s.kind === 'post_intent'),
    }),
    [openSignals],
  )

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.lime }}>Could not load signals: {error}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {actionError && (
        <span style={{ ...label, color: color.lime }}>{actionError}</span>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {actionableKinds.map((kind) => (
          <PulseColumn key={kind} kind={kind} signals={columns[kind]} onDone={markHandled} />
        ))}
      </div>
      <WeekTable signals={weekSignals} />
    </div>
  )
}

function PulseColumn({
  kind,
  signals,
  onDone,
}: {
  kind: SignalKind
  signals: SignalWithContact[]
  onDone: (id: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: surfaceGradient,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        boxShadow: cardShadow,
        minHeight: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, color: color.muted }}>{kindLabel[kind]}</span>
        <span style={{ ...label, color: color.accent }}>{signals.length}</span>
      </div>
      {signals.length === 0 && (
        <span style={{ fontSize: 13, color: color.dim }}>Nothing here.</span>
      )}
      {signals.map((s) => (
        <SignalCard key={s.id} signal={s} onDone={onDone} />
      ))}
    </div>
  )
}

function SignalCard({ signal, onDone }: { signal: SignalWithContact; onDone: (id: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.sm,
      }}
    >
      <Link
        to={`/contact/${signal.contact.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: color.text }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: color.surface,
            border: `1px solid ${color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.mono,
            fontSize: 11,
            color: color.accent,
            flexShrink: 0,
          }}
        >
          {initials(signal.contact.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.body, fontSize: 13.5, fontWeight: 500 }}>{signal.contact.name}</div>
          {signal.contact.company && (
            <div style={{ fontSize: 11.5, color: color.muted }}>{signal.contact.company}</div>
          )}
        </div>
      </Link>
      {signal.detail && <div style={{ fontSize: 12.5, color: color.muted, lineHeight: 1.4 }}>{signal.detail}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, color: color.dim, fontSize: 9.5 }}>{daysAgo(signal.occurred_at)}</span>
        <button
          type="button"
          onClick={() => onDone(signal.id)}
          style={{
            ...label,
            padding: '6px 10px',
            background: 'rgba(79,227,155,.11)',
            border: '1px solid rgba(79,227,155,.34)',
            borderRadius: radius.sm - 6,
            color: color.accent,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function WeekTable({ signals }: { signals: SignalWithContact[] }) {
  return (
    <Section title="This week">
      {signals.length === 0 ? (
        <span style={{ fontSize: 13, color: color.dim }}>No signals in the last 7 days.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signals.map((s) => (
            <SignalRow
              key={s.id}
              date={new Date(s.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              kind={kindLabel[s.kind]}
              detail={s.detail}
              contact={{ id: s.contact.id, name: s.contact.name }}
            />
          ))}
        </div>
      )}
    </Section>
  )
}
