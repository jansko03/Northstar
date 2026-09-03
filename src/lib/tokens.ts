import type { CSSProperties } from 'react'
import type { ContactType, SignalKind, Stage, Tier } from './types'

export const color = {
  bg: '#131313',
  surface: 'rgba(255,255,255,.04)',
  border: 'rgba(255,255,255,.08)',
  text: '#E9EDE9',
  muted: '#8A928B',
  dim: '#5E665F',
  accent: '#00FF3A',
  warn: '#FF4D4D',
} as const

// Flat card fill — no gradient/drop shadow, just a thin border, to match
// the sharper reference look.
export const surfaceGradient = 'rgba(255,255,255,.035)'
export const cardShadow = 'none'

export const radius = {
  sm: 8,
  lg: 10,
} as const

export const font = {
  body: "'Hanken Grotesk', sans-serif",
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
  warming: color.text,
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
  keep_warm: color.text,
  nurture: color.muted,
  parked: color.dim,
}

export const contactTypeLabel: Record<ContactType, string> = {
  client: 'Client',
  partner: 'Partner',
  channel: 'Channel',
  peer: 'Peer',
  unknown: 'Unknown',
}

export const kindLabel: Record<SignalKind, string> = {
  reaction: 'Reaction',
  comment: 'Comment',
  job_change: 'Job Change',
  funding: 'Funding',
  post_intent: 'Post Intent',
}
