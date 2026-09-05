import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { color, font, kindLabel, label, radius } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
import { pushNotifications } from '../lib/notificationStore'
import {
  ALL_KINDS,
  PHRASES,
  buildPools,
  generateNotifications,
  hourStartOf,
  poolsConfigured,
} from '../lib/useSimulatedNotifications'
import type { ContactWithScore, SignalKind } from '../lib/types'

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

export function Admin() {
  const { contacts, loading: contactsLoading } = useContactsWithScore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pulseKinds, setPulseKinds] = useState<SignalKind[]>([])
  const [notifyKinds, setNotifyKinds] = useState<SignalKind[]>([])
  const [notifyContactIds, setNotifyContactIds] = useState<string[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const isMobile = useIsMobile()

  // Memoized (not recomputed inline in the JSX below) so its reference stays
  // stable across renders that don't actually change contacts/notifyContactIds
  // (e.g. typing in the search box) — SimulatedFeed's effect depends on this
  // array by reference, and an unstable reference would restart its timer on
  // every keystroke. Placed before the loading early-return below since
  // hooks can't be called after a conditional return.
  const watchlist = useMemo(
    () => contacts.filter((c) => notifyContactIds.includes(c.id)),
    [contacts, notifyContactIds],
  )

  async function load() {
    const userRes = await supabase.from('app_user').select('*').eq('id', DEFAULT_USER_ID).maybeSingle()
    if (userRes.data) {
      setPulseKinds((userRes.data.pulse_actionable_kinds ?? []) as SignalKind[])
      setNotifyKinds((userRes.data.notify_kinds ?? []) as SignalKind[])
      setNotifyContactIds((userRes.data.notify_contact_ids ?? []) as string[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(list: SignalKind[], setList: (kinds: SignalKind[]) => void, kind: SignalKind) {
    setList(list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind])
  }

  function addContact(id: string) {
    setNotifyContactIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setContactSearch('')
  }

  function removeContact(id: string) {
    setNotifyContactIds((prev) => prev.filter((c) => c !== id))
  }

  async function save() {
    setSaving(true)
    await supabase
      .from('app_user')
      .update({
        pulse_actionable_kinds: pulseKinds,
        notify_kinds: notifyKinds,
        notify_contact_ids: notifyContactIds,
      })
      .eq('id', DEFAULT_USER_ID)
    setSaving(false)
  }

  if (loading || contactsLoading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  const searchMatches =
    contactSearch.trim().length > 0
      ? contacts
          .filter(
            (c) =>
              !notifyContactIds.includes(c.id) &&
              c.name.toLowerCase().includes(contactSearch.trim().toLowerCase()),
          )
          .slice(0, 6)
      : []

  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600, color: color.text }}>Admin</div>
        <div style={{ ...label, color: color.dim, marginTop: 4 }}>Configure Pulse and notifications</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
        <Section title="Pulse">
          <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
            Signal kinds that show up as actionable columns on the Pulse screen.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_KINDS.map((kind) => (
              <KindChip
                key={kind}
                active={pulseKinds.includes(kind)}
                label={kindLabel[kind]}
                onClick={() => toggle(pulseKinds, setPulseKinds, kind)}
              />
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
            Signal kinds you want to be notified about.
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_KINDS.map((kind) => (
              <KindChip
                key={kind}
                active={notifyKinds.includes(kind)}
                label={kindLabel[kind]}
                onClick={() => toggle(notifyKinds, setNotifyKinds, kind)}
              />
            ))}
          </div>
        </Section>

        <Section title="Watchlist">
          <span style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
            Specific people to notify about no matter what they do.
          </span>
          <input
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contacts to add"
            style={inputStyle}
          />
          {searchMatches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addContact(c.id)}
                  style={{
                    ...label,
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: color.surface,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm - 6,
                    color: color.text,
                    cursor: 'pointer',
                  }}
                >
                  + {c.name}
                  {c.company ? ` · ${c.company}` : ''}
                </button>
              ))}
            </div>
          )}
          {watchlist.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {watchlist.map((c) => (
                <ContactChip key={c.id} name={c.name} onRemove={() => removeContact(c.id)} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Simulated notifications">
          <PopulateButton contacts={contacts} notifyKinds={notifyKinds} notifyContactIds={notifyContactIds} />
          <SimulatedFeed notifyKinds={notifyKinds} watchlist={watchlist} contacts={contacts} />
        </Section>
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            ...label,
            padding: '10px 18px',
            background: 'rgba(0,255,58,.11)',
            border: '1px solid rgba(0,255,58,.34)',
            borderRadius: radius.sm,
            color: color.accent,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function KindChip({ active, label: text, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? color.accent : color.border}`,
        background: active ? 'rgba(0,255,58,.08)' : color.surface,
        color: active ? color.accent : color.muted,
        fontFamily: font.body,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {text}
    </button>
  )
}

function ContactChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 6px 6px 12px',
        borderRadius: 999,
        border: `1px solid ${color.accent}`,
        background: 'rgba(0,255,58,.08)',
        color: color.accent,
        fontFamily: font.body,
        fontSize: 13,
      }}
    >
      {name}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name} from watchlist`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,255,58,.16)',
          color: color.accent,
          fontSize: 12,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </span>
  )
}

// How many notifications one press of "Populate Pulse" adds.
const POPULATE_COUNT = 3

function PopulateButton({
  contacts,
  notifyKinds,
  notifyContactIds,
}: {
  contacts: ContactWithScore[]
  notifyKinds: SignalKind[]
  notifyContactIds: string[]
}) {
  const pools = useMemo(
    () => buildPools(contacts, notifyKinds, notifyContactIds),
    [contacts, notifyKinds, notifyContactIds],
  )
  const enabled = poolsConfigured(pools)

  function populate() {
    const now = Date.now()
    pushNotifications(hourStartOf(now), generateNotifications(pools, POPULATE_COUNT, now))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={populate}
        disabled={!enabled}
        style={{
          ...label,
          padding: '9px 14px',
          background: enabled ? 'rgba(0,255,58,.11)' : color.surface,
          border: `1px solid ${enabled ? 'rgba(0,255,58,.34)' : color.border}`,
          borderRadius: radius.sm,
          color: enabled ? color.accent : color.dim,
          cursor: enabled ? 'pointer' : 'default',
        }}
      >
        Populate Pulse
      </button>
      <span style={{ fontSize: 12, color: color.dim, lineHeight: 1.5 }}>
        {enabled
          ? `Adds ${POPULATE_COUNT} notifications to the Pulse feed. Clears on the hour.`
          : 'Pick a signal kind or watch someone first.'}
      </span>
    </div>
  )
}

interface SimEvent {
  id: string
  contactName: string
  kind: SignalKind
  detail: string
  time: string
}

function SimulatedFeed({
  notifyKinds,
  watchlist,
  contacts,
}: {
  notifyKinds: SignalKind[]
  watchlist: ContactWithScore[]
  contacts: ContactWithScore[]
}) {
  const [events, setEvents] = useState<SimEvent[]>([])

  useEffect(() => {
    const generalPool = notifyKinds.length > 0 && contacts.length > 0
    const watchPool = watchlist.length > 0

    if (!generalPool && !watchPool) return

    const id = setInterval(() => {
      const useWatchPool = generalPool && watchPool ? Math.random() < 0.5 : watchPool

      let contact: ContactWithScore
      let kind: SignalKind

      if (useWatchPool) {
        contact = watchlist[Math.floor(Math.random() * watchlist.length)]
        kind = ALL_KINDS[Math.floor(Math.random() * ALL_KINDS.length)]
      } else {
        contact = contacts[Math.floor(Math.random() * contacts.length)]
        kind = notifyKinds[Math.floor(Math.random() * notifyKinds.length)]
      }

      const phrases = PHRASES[kind]
      const detail = phrases[Math.floor(Math.random() * phrases.length)]

      setEvents((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random()}`,
            contactName: contact.name,
            kind,
            detail,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev,
        ].slice(0, 8),
      )
    }, 5000)

    return () => clearInterval(id)
  }, [notifyKinds, watchlist, contacts])

  if (events.length === 0) {
    return (
      <span style={{ fontSize: 13, color: color.dim }}>
        Enable a kind or watch someone to see notifications here.
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((e) => (
        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 500, color: color.text }}>
              {e.contactName}
            </span>
            <span style={{ ...label, color: color.dim, fontSize: 9.5 }}>{e.time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ ...label, color: color.accent, flexShrink: 0 }}>{kindLabel[e.kind]}</span>
            <span style={{ fontSize: 12.5, color: color.muted }}>{e.detail}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
