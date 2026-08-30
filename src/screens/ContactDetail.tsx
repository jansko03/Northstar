import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Section, StatCell } from '../components/Section'
import { SignalRow } from '../components/SignalRow'
import { daysAgo, initials } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../lib/useIsMobile'
import {
  cardShadow,
  color,
  font,
  label,
  radius,
  stageColor,
  stageHint,
  stageLabel,
  surfaceGradient,
  tierColor,
  tierLabel,
} from '../lib/tokens'
import type { Contact, ContactScore, Note, Signal, Stage } from '../lib/types'

const pipeline: Stage[] = ['silent', 'warming', 'contacted', 'conversation']

function formatSignalDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const [contact, setContact] = useState<Contact | null>(null)
  const [score, setScore] = useState<ContactScore | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [eventDraft, setEventDraft] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)
  const isMobile = useIsMobile()

  async function load() {
    if (!id) return
    const [c, s, sig, nt] = await Promise.all([
      supabase.from('contact').select('*').eq('id', id).maybeSingle(),
      supabase.from('contact_score').select('*').eq('id', id).maybeSingle(),
      supabase.from('signal').select('*').eq('contact_id', id).order('occurred_at', { ascending: false }),
      supabase.from('note').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    ])
    if (!c.data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setContact(c.data)
    setScore(s.data)
    setSignals(sig.data ?? [])
    setNotes(nt.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function moveStage(next: Stage) {
    if (!contact) return
    const fromStage = contact.stage
    setContact({ ...contact, stage: next })
    await supabase.from('contact').update({ stage: next }).eq('id', contact.id)
    await supabase.from('stage_event').insert({ contact_id: contact.id, from_stage: fromStage, to_stage: next })
    load()
  }

  async function toggleDormant() {
    if (!contact) return
    await moveStage(contact.stage === 'dormant' ? 'contacted' : 'dormant')
  }

  async function stepBack() {
    if (!contact) return
    const idx = pipeline.indexOf(contact.stage)
    if (idx > 0) await moveStage(pipeline[idx - 1])
  }

  async function addNote() {
    if (!contact) return
    const body = noteDraft.trim()
    if (!body) return
    setSavingNote(true)
    setNoteDraft('')
    await supabase.from('note').insert({ contact_id: contact.id, body, channel: 'note' })
    await load()
    setSavingNote(false)
  }

  async function addEvent() {
    if (!contact) return
    const body = eventDraft.trim()
    if (!body) return
    setSavingEvent(true)
    setEventDraft('')
    await supabase.from('note').insert({ contact_id: contact.id, body, channel: 'meeting' })
    await load()
    setSavingEvent(false)
  }

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (notFound || !contact) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ ...label, color: color.lime }}>Contact not found.</span>
        <Link to="/network" style={{ ...label, color: color.accent }}>
          ← Back to network
        </Link>
      </div>
    )
  }

  const subtitle = [contact.role_title, contact.company].filter(Boolean).join(' · ')
  const tier = score?.tier ?? 'parked'
  const scoreValue = score?.score ?? 0
  const reactions = signals.filter((s) => s.kind === 'reaction').length
  const comments = signals.filter((s) => s.kind === 'comment').length
  const currentPipelineIndex = pipeline.indexOf(contact.stage)
  const privateNotes = notes.filter((n) => n.channel === 'note')
  const events = notes.filter((n) => n.channel === 'meeting')

  return (
    <div
      style={{
        padding: isMobile ? 16 : 32,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 20,
        alignItems: 'flex-start',
      }}
    >
      <aside
        style={{
          position: isMobile ? 'static' : 'sticky',
          top: isMobile ? undefined : 84,
          width: isMobile ? '100%' : 344,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: surfaceGradient,
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: cardShadow,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '26px 22px 20px',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <Link to="/network" style={{ ...label, color: color.dim, alignSelf: 'flex-start', textDecoration: 'none' }}>
            ← Network
          </Link>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${color.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: font.mono,
              fontSize: 24,
              color: color.accent,
              marginTop: 4,
            }}
          >
            {initials(contact.name)}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600 }}>{contact.name}</div>
            {subtitle && <div style={{ fontSize: 13, color: color.muted, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor[contact.stage] }} />
            <span style={{ ...label, color: color.muted }}>{stageLabel[contact.stage]}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            padding: '16px 22px',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ ...label, color: tierColor[tier] }}>{tierLabel[tier]}</span>
            <span style={{ ...label, color: color.dim }}>{scoreValue}/100</span>
          </div>
          <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,.08)' }}>
            <div style={{ height: 3, borderRadius: 3, width: `${scoreValue}%`, background: tierColor[tier] }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${color.border}` }}>
          <StatCell label="Reactions" value={reactions} borderRight />
          <StatCell label="Comments" value={comments} borderRight />
          <StatCell label="Last touch" value={daysAgo(contact.last_touch_at)} small />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '18px 22px' }}>
          {contact.email ? (
            <a
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}`}
              target="_blank"
              rel="noreferrer"
              style={{
                ...label,
                padding: '12px',
                textAlign: 'center',
                background: 'rgba(79,227,155,.11)',
                border: `1px solid rgba(79,227,155,.34)`,
                borderRadius: radius.sm,
                color: color.accent,
                textDecoration: 'none',
              }}
            >
              Write email
            </a>
          ) : (
            <span
              style={{
                ...label,
                padding: '12px',
                textAlign: 'center',
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                color: color.dim,
              }}
            >
              No email on file
            </span>
          )}
          {contact.linkedin_url ? (
            <a
              href={contact.linkedin_url}
              target="_blank"
              rel="noreferrer"
              style={{
                ...label,
                padding: '11px',
                textAlign: 'center',
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                color: color.muted,
                textDecoration: 'none',
              }}
            >
              Open LinkedIn
            </a>
          ) : (
            <span
              style={{
                ...label,
                padding: '11px',
                textAlign: 'center',
                background: 'rgba(255,255,255,.02)',
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                color: color.dim,
              }}
            >
              No LinkedIn on file
            </span>
          )}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Relationship journey">
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
            {pipeline.map((step, i) => {
              const isCurrent = step === contact.stage
              const isPast = currentPipelineIndex > -1 && i < currentPipelineIndex
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => moveStage(step)}
                  className="ns-stage-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: isMobile ? '8px 6px' : '11px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: isCurrent ? 'rgba(79,227,155,.09)' : color.surface,
                    border: `1px solid ${isCurrent ? color.accent : color.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: isCurrent || isPast ? stageColor[step] : color.dim,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        borderRadius: 2,
                        background: isCurrent || isPast ? 'rgba(79,227,155,.28)' : color.border,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      lineHeight: 1.25,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? color.text : isPast ? color.muted : color.dim,
                    }}
                  >
                    {stageLabel[step]}
                  </span>
                  <span style={{ ...label, fontSize: 9, color: isCurrent ? color.accent : color.dim }}>
                    {isCurrent ? 'Current' : stageHint[step]}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 12,
              padding: '11px 13px',
              background: 'rgba(255,255,255,.024)',
              border: '1px solid rgba(255,255,255,.05)',
              borderRadius: 10,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: stageColor[contact.stage],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12.5, color: color.muted }}>
              Now: <strong style={{ color: color.text }}>{stageLabel[contact.stage]}</strong>
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={stepBack}
              disabled={currentPipelineIndex <= 0}
              className="ns-stage-btn"
              style={{
                fontFamily: font.body,
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 8,
                background: 'none',
                border: '1px solid rgba(255,255,255,.09)',
                color: currentPipelineIndex > 0 ? color.muted : color.dim,
                cursor: currentPipelineIndex > 0 ? 'pointer' : 'default',
              }}
            >
              ← Step back
            </button>
            <button
              type="button"
              onClick={toggleDormant}
              style={{ ...label, background: 'none', border: 'none', color: color.dim, cursor: 'pointer' }}
            >
              {contact.stage === 'dormant' ? 'Revive from dormant' : 'Park as dormant'}
            </button>
          </div>

          <span style={{ fontSize: 12, lineHeight: 1.5, color: color.dim }}>
            A later stage pulls them closer to the centre of your map.
          </span>
        </Section>

        <Section title="Signal history">
          {signals.length === 0 ? (
            <span style={{ fontSize: 13, color: color.dim }}>No signals recorded yet.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signals.map((s) => (
                <SignalRow key={s.id} date={formatSignalDate(s.occurred_at)} kind={s.kind} detail={s.detail} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Private notes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {privateNotes.map((n) => (
              <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 12, borderLeft: `1px solid ${color.border}` }}>
                <span style={{ ...label, color: color.dim, fontSize: 10 }}>
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
                <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>{n.body}</span>
              </div>
            ))}
            {privateNotes.length === 0 && <span style={{ fontSize: 13, color: color.dim }}>No notes yet.</span>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note…"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: color.surface,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  padding: '9px 11px',
                  color: color.text,
                  fontFamily: font.body,
                  fontSize: 12.5,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={addNote}
                disabled={savingNote || !noteDraft.trim()}
                style={{
                  ...label,
                  padding: '9px 14px',
                  background: 'rgba(79,227,155,.11)',
                  border: `1px solid rgba(79,227,155,.34)`,
                  borderRadius: radius.sm,
                  color: color.accent,
                  cursor: savingNote ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Add note
              </button>
            </div>
          </div>
        </Section>

        <Section title="Events & meetings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 5,
                    borderRadius: '50%',
                    background: color.accent,
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: color.text }}>{e.body}</span>
                  <span style={{ ...label, color: color.dim, fontSize: 10 }}>
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {events.length === 0 && <span style={{ fontSize: 13, color: color.dim }}>No shared events yet.</span>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                value={eventDraft}
                onChange={(e) => setEventDraft(e.target.value)}
                placeholder="Event or meeting, e.g. &quot;Coffee in Bratislava — 12 Jun&quot;"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: color.surface,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  padding: '9px 11px',
                  color: color.text,
                  fontFamily: font.body,
                  fontSize: 12.5,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={addEvent}
                disabled={savingEvent || !eventDraft.trim()}
                style={{
                  ...label,
                  padding: '9px 14px',
                  background: 'rgba(79,227,155,.11)',
                  border: `1px solid rgba(79,227,155,.34)`,
                  borderRadius: radius.sm,
                  color: color.accent,
                  cursor: savingEvent ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

