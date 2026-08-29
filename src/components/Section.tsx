import type { ReactNode } from 'react'
import { cardShadow, color, label, radius, surfaceGradient } from '../lib/tokens'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
        padding: 20,
        background: surfaceGradient,
        border: `1px solid ${color.border}`,
        boxShadow: cardShadow,
        borderRadius: radius.lg,
      }}
    >
      <span style={{ ...label, color: color.muted }}>{title}</span>
      {children}
    </div>
  )
}

export function StatCell({
  label: statLabel,
  value,
  borderRight,
  small,
}: {
  label: string
  value: string | number
  borderRight?: boolean
  small?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: '14px 14px',
        borderRight: borderRight ? `1px solid ${color.border}` : undefined,
      }}
    >
      <span style={{ ...label, color: color.dim, fontSize: 9.5 }}>{statLabel}</span>
      <span style={{ fontSize: small ? 15 : 16, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
