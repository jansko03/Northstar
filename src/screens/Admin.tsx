import { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { color, font, kindLabel, label, radius } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
import type { SignalKind } from '../lib/types'

const ALL_KINDS: SignalKind[] = ['reaction', 'comment', 'job_change', 'funding', 'post_intent']

export function Admin() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pulseKinds, setPulseKinds] = useState<SignalKind[]>([])
  const [notifyKinds, setNotifyKinds] = useState<SignalKind[]>([])
  const isMobile = useIsMobile()

  async function load() {
    const userRes = await supabase.from('app_user').select('*').eq('id', DEFAULT_USER_ID).maybeSingle()
    if (userRes.data) {
      setPulseKinds((userRes.data.pulse_actionable_kinds ?? []) as SignalKind[])
      setNotifyKinds((userRes.data.notify_kinds ?? []) as SignalKind[])
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

  async function save() {
    setSaving(true)
    await supabase
      .from('app_user')
      .update({ pulse_actionable_kinds: pulseKinds, notify_kinds: notifyKinds })
      .eq('id', DEFAULT_USER_ID)
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

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
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            ...label,
            padding: '10px 18px',
            background: 'rgba(79,227,155,.11)',
            border: '1px solid rgba(79,227,155,.34)',
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
        background: active ? 'rgba(79,227,155,.08)' : color.surface,
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
