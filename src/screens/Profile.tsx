import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, StatCell } from '../components/Section'
import { initials } from '../lib/format'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import {
  cardShadow,
  color,
  font,
  label,
  radius,
  stageColor,
  stageLabel,
  surfaceGradient,
  tierColor,
  tierLabel,
} from '../lib/tokens'
import type { AppUser, Stage, Tier } from '../lib/types'

const TIERS: Tier[] = ['act_now', 'keep_warm', 'nurture', 'parked']
const STAGES: Stage[] = ['conversation', 'contacted', 'warming', 'silent', 'dormant']

interface WeekStats {
  reactions: number
  comments: number
  stageMoves: number
  notesAdded: number
}

const inputStyle = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  padding: '8px 10px',
  color: color.text,
  fontFamily: font.body,
  fontSize: 13,
  outline: 'none',
} as const

export function Profile() {
  const { contacts, loading: contactsLoading } = useContactsWithScore()
  const [user, setUser] = useState<AppUser | null>(null)
  const [week, setWeek] = useState<WeekStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [headlineDraft, setHeadlineDraft] = useState('')
  const [lookingForDraft, setLookingForDraft] = useState('')

  async function load() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const sevenDaysAgoIso = sevenDaysAgo.toISOString()
    const sevenDaysAgoDate = sevenDaysAgoIso.slice(0, 10)

    const [userRes, reactionsRes, commentsRes, stageMovesRes, notesRes] = await Promise.all([
      supabase.from('app_user').select('*').eq('id', DEFAULT_USER_ID).maybeSingle(),
      supabase
        .from('signal')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'reaction')
        .gte('occurred_at', sevenDaysAgoDate),
      supabase
        .from('signal')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'comment')
        .gte('occurred_at', sevenDaysAgoDate),
      supabase.from('stage_event').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgoIso),
      supabase
        .from('note')
        .select('id', { count: 'exact', head: true })
        .eq('channel', 'note')
        .gte('created_at', sevenDaysAgoIso),
    ])

    if (userRes.data) {
      setUser(userRes.data)
      setNameDraft(userRes.data.name)
      setHeadlineDraft(userRes.data.headline ?? '')
      setLookingForDraft(userRes.data.looking_for ?? '')
    }
    setWeek({
      reactions: reactionsRes.count ?? 0,
      comments: commentsRes.count ?? 0,
      stageMoves: stageMovesRes.count ?? 0,
      notesAdded: notesRes.count ?? 0,
    })
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setSaving(true)
    await supabase
      .from('app_user')
      .update({
        name: nameDraft.trim() || 'Me',
        headline: headlineDraft.trim() || null,
        looking_for: lookingForDraft.trim() || null,
      })
      .eq('id', DEFAULT_USER_ID)
    await load()
    setSaving(false)
    setEditing(false)
  }

  function cancelEdit() {
    setNameDraft(user?.name ?? '')
    setHeadlineDraft(user?.headline ?? '')
    setLookingForDraft(user?.looking_for ?? '')
    setEditing(false)
  }

  const counts = useMemo(() => {
    const byTier: Record<Tier, number> = { act_now: 0, keep_warm: 0, nurture: 0, parked: 0 }
    const byStage: Record<Stage, number> = { silent: 0, warming: 0, contacted: 0, conversation: 0, dormant: 0 }
    for (const c of contacts) {
      if (c.score) byTier[c.score.tier]++
      byStage[c.stage]++
    }
    return { byTier, byStage }
  }, [contacts])

  const mappedCount = contacts.filter((c) => c.score).length
  const waiting = contacts.filter((c) => c.score?.tier === 'act_now').slice(0, 6)

  if (loading || contactsLoading) {
    return (
      <div style={{ padding: 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '344px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <aside
        style={{
          position: 'sticky',
          top: 84,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ ...label, color: color.dim }}>Your profile</span>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{ ...label, background: 'none', border: 'none', color: color.dim, cursor: 'pointer' }}
              >
                Edit
              </button>
            )}
          </div>

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
            }}
          >
            {initials(user?.name || 'Me')}
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                style={{ ...inputStyle, textAlign: 'center', fontSize: 17, fontWeight: 600 }}
              />
              <input
                value={headlineDraft}
                onChange={(e) => setHeadlineDraft(e.target.value)}
                placeholder="What you do"
                style={{ ...inputStyle, textAlign: 'center' }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600 }}>{user?.name}</div>
              {user?.headline && <div style={{ fontSize: 13, color: color.muted, marginTop: 4 }}>{user.headline}</div>}
            </div>
          )}

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '4px 11px',
              borderRadius: 20,
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${color.border}`,
              fontFamily: font.mono,
              fontSize: 10,
              letterSpacing: '.08em',
              color: color.accent,
            }}
          >
            <span className="ns-pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: color.accent }} />
            {waiting.length} need you now
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${color.border}` }}>
          <StatCell label="Contacts tracked" value={contacts.length} borderRight />
          <StatCell label="On your map" value={mappedCount} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 22px' }}>
          <span style={{ ...label, color: color.dim, fontSize: 9.5 }}>Who you are looking for</span>
          {editing ? (
            <textarea
              value={lookingForDraft}
              onChange={(e) => setLookingForDraft(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          ) : (
            <span style={{ fontSize: 13, lineHeight: 1.55, color: color.muted }}>
              {user?.looking_for || 'Not set yet.'}
            </span>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 8, padding: '0 22px 22px' }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                flex: 1,
                ...label,
                padding: '10px',
                textAlign: 'center',
                background: 'rgba(79,227,155,.11)',
                border: `1px solid rgba(79,227,155,.34)`,
                borderRadius: radius.sm,
                color: color.accent,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              style={{
                flex: 1,
                ...label,
                padding: '10px',
                textAlign: 'center',
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                color: color.muted,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
          <Section title="Your network by priority">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TIERS.map((tier) => (
                <StatBar
                  key={tier}
                  dot={tierColor[tier]}
                  text={tierLabel[tier]}
                  count={counts.byTier[tier]}
                  total={contacts.length}
                />
              ))}
            </div>
          </Section>
          <Section title="By relationship state">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {STAGES.map((stage) => (
                <StatBar
                  key={stage}
                  dot={stageColor[stage]}
                  text={stageLabel[stage]}
                  count={counts.byStage[stage]}
                  total={contacts.length}
                />
              ))}
            </div>
          </Section>
        </div>

        <Section title="Your week">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '14px 15px',
                background: 'rgba(255,255,255,.024)',
                border: `1px solid ${color.border}`,
                borderRadius: 11,
              }}
            >
              <span style={{ ...label, fontSize: 9.5, color: color.accent }}>Reactions</span>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{week?.reactions ?? 0}</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '14px 15px',
                background: 'rgba(255,255,255,.024)',
                border: `1px solid ${color.border}`,
                borderRadius: 11,
              }}
            >
              <span style={{ ...label, fontSize: 9.5, color: color.lime }}>Comments</span>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{week?.comments ?? 0}</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '14px 15px',
                background: 'rgba(255,255,255,.024)',
                border: `1px solid ${color.border}`,
                borderRadius: 11,
              }}
            >
              <span style={{ ...label, fontSize: 9.5, color: color.accent }}>Stage moves logged</span>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{week?.stageMoves ?? 0}</span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                padding: '14px 15px',
                background: 'rgba(255,255,255,.024)',
                border: `1px solid ${color.border}`,
                borderRadius: 11,
              }}
            >
              <span style={{ ...label, fontSize: 9.5, color: color.lime }}>Notes you added</span>
              <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{week?.notesAdded ?? 0}</span>
            </div>
          </div>
        </Section>

        <Section title="Waiting on you">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {waiting.map((c) => (
              <Link
                key={c.id}
                to={`/contact/${c.id}`}
                className="ns-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 13px',
                  background: 'rgba(255,255,255,.024)',
                  border: `1px solid ${color.border}`,
                  borderRadius: 11,
                  textDecoration: 'none',
                  color: color.text,
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#161A17',
                    border: `1px solid ${stageColor[c.stage]}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: font.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    color: color.muted,
                  }}
                >
                  {initials(c.name)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: color.muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {[c.role_title, c.company].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
                <span style={{ fontFamily: font.mono, fontSize: 14, color: color.accent, flexShrink: 0 }}>
                  {c.score?.score}
                </span>
              </Link>
            ))}
            {waiting.length === 0 && (
              <span style={{ fontSize: 13, color: color.dim }}>Nobody is waiting on you right now.</span>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}

function StatBar({ dot, text, count, total }: { dot: string; text: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: color.muted }}>{text}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.muted }}>{count}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,.07)' }}>
        <div style={{ height: 4, borderRadius: 3, width: `${pct}%`, background: dot }} />
      </div>
    </div>
  )
}
