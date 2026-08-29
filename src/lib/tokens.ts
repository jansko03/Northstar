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

// A slightly richer surface treatment (gradient + inset highlight + drop shadow)
// for cards that carry more content, e.g. contact detail panels.
export const surfaceGradient = 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.014))'
export const cardShadow = '0 1px 0 rgba(255,255,255,.04) inset, 0 14px 34px -20px rgba(0,0,0,.95)'

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

// Short hint shown under each stage in the relationship-journey pipeline.
export const stageHint: Record<Stage, string> = {
  silent: 'Watching you',
  warming: 'Engaging often',
  contacted: 'You reached out',
  conversation: 'Talking now',
  dormant: 'Parked',
}

export const tierLabel: Record<Tier, string> = {
  act_now: 'Act now',
  keep_warm: 'Keep warm',
  nurture: 'Nurture',
  parked: 'Parked',
}

export const tierColor: Record<Tier, string> = {
  act_now: color.accent,
  keep_warm: color.lime,
  nurture: color.muted,
  parked: color.dim,
}
