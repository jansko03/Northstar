import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { initials } from '../lib/format'
import { color, font, label, radius as radiusToken, stageColor, stageLabel, tierColor, tierLabel } from '../lib/tokens'
import type { ContactWithScore, Stage, Tier } from '../lib/types'

const TIER_ORDER: Tier[] = ['act_now', 'keep_warm', 'nurture', 'parked']
const TIER_RADIUS: Record<Tier, number> = { act_now: 150, keep_warm: 232, nurture: 300, parked: 346 }
const TIER_OFFSET: Record<Tier, number> = { act_now: -55, keep_warm: 68, nurture: 22, parked: 15 }
const STAGES: Stage[] = ['conversation', 'contacted', 'warming', 'silent', 'dormant']
const MAP_HEIGHT = 780

function tierOf(contact: ContactWithScore): Tier {
  return contact.score?.tier ?? 'parked'
}

function nodeSize(score: number): number {
  return Math.round(26 + score * 0.24)
}

interface Node {
  contact: ContactWithScore
  angleDeg: number
  radius: number
  x: number
  y: number
  size: number
}

export function NetworkMap({ contacts }: { contacts: ContactWithScore[] }) {
  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = []
    for (const tier of TIER_ORDER) {
      const group = contacts.filter((c) => tierOf(c) === tier)
      const r = TIER_RADIUS[tier]
      group.forEach((contact, i) => {
        const angleDeg = TIER_OFFSET[tier] + (i * 360) / Math.max(group.length, 1)
        const rad = (angleDeg * Math.PI) / 180
        out.push({
          contact,
          angleDeg,
          radius: r,
          x: r * Math.cos(rad),
          y: r * Math.sin(rad),
          size: nodeSize(contact.score?.score ?? 0),
        })
      })
    }
    return out
  }, [contacts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: MAP_HEIGHT,
          background: '#0C0E0C',
          border: `1px solid ${color.border}`,
          borderRadius: radiusToken.lg,
          overflow: 'hidden',
        }}
      >
        {TIER_ORDER.map((tier) => (
          <div
            key={tier}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: TIER_RADIUS[tier] * 2,
              height: TIER_RADIUS[tier] * 2,
              transform: 'translate(-50%, -50%)',
              border: '1px solid rgba(255,255,255,.07)',
              borderRadius: '50%',
            }}
          />
        ))}

        {nodes.map(({ contact, angleDeg, radius: r }) => (
          <div
            key={`${contact.id}-line`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: r,
              height: 1,
              background: 'rgba(255,255,255,.06)',
              transformOrigin: 'left center',
              transform: `rotate(${angleDeg}deg)`,
            }}
          />
        ))}

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: '#0F1710',
            border: `1px solid ${color.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: font.body, fontSize: 15, fontWeight: 700, color: color.accent }}>YOU</span>
        </div>

        {nodes.map(({ contact, x, y, size }) => (
          <Link
            key={contact.id}
            to={`/contact/${contact.id}`}
            style={{
              position: 'absolute',
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: size,
                height: size,
                borderRadius: '50%',
                background: '#111511',
                border: `1px solid ${stageColor[contact.stage]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: font.mono,
                fontSize: size < 40 ? 10 : 11.5,
                fontWeight: 600,
                color: stageColor[contact.stage],
              }}
            >
              {initials(contact.name)}
              {(contact.score?.open_events ?? 0) > 0 && (
                <span
                  className="ns-pulse-dot"
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: color.accent,
                    border: '1px solid #0C0E0C',
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: 11, color: color.muted, whiteSpace: 'nowrap' }}>
              {contact.name.split(' ')[0]}
            </span>
          </Link>
        ))}

        {contacts.length === 0 && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, 64px)',
              ...label,
              color: color.dim,
            }}
          >
            Nobody matches this filter.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 36, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ ...label, color: color.muted }}>Distance = priority</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {TIER_ORDER.map((tier) => (
              <LegendItem
                key={tier}
                dot={tierColor[tier]}
                text={tierLabel[tier]}
                count={contacts.filter((c) => tierOf(c) === tier).length}
              />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ ...label, color: color.muted }}>Ring colour = state</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {STAGES.map((stage) => (
              <LegendItem
                key={stage}
                dot={stageColor[stage]}
                text={stageLabel[stage]}
                count={contacts.filter((c) => c.stage === stage).length}
                ring
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendItem({ dot, text, count, ring }: { dot: string; text: string; count: number; ring?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: color.muted, whiteSpace: 'nowrap' }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: ring ? 'transparent' : dot,
          border: ring ? `1px solid ${dot}` : 'none',
        }}
      />
      {text}
      <span style={{ fontFamily: font.mono, fontSize: 11, color: color.dim }}>{count}</span>
    </div>
  )
}
