import type { CSSProperties } from 'react'
import type { Stage, Tier } from './types'

export const color = {
  bg: '#080908',
  surface: 'rgba(255,255,255,.04)',
  border: 'rgba(255,255,255,.07)',
  text: '#E9EDE9',
  muted: '#8A928B',
  dim: '#5E665F',
  accent: '#4FE39B',
  lime: '#D8F26A',
} as const

export const radius = {
  sm: 14,
  lg: 18,
} as const

export const font = {
  body: "'Space Grotesk', sans-serif",
  mono: "'IBM Plex Mono', monospace",
} as const

export const label: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 10.5,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
}

export const stageColor: Record<Stage, string> = {
  silent: color.dim,
  warming: color.lime,
  contacted: color.accent,
  conversation: color.accent,
  dormant: color.muted,
}

export const stageLabel: Record<Stage, string> = {
  silent: 'Silent',
  warming: 'Warming',
  contacted: 'Contacted',
  conversation: 'Conversation',
  dormant: 'Dormant',
}

export const tierLabel: Record<Tier, string> = {
  act_now: 'Act now',
  keep_warm: 'Keep warm',
  nurture: 'Nurture',
  parked: 'Parked',
}
