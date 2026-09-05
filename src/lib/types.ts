export type Stage = 'silent' | 'warming' | 'contacted' | 'conversation' | 'dormant'

export type ContactType = 'client' | 'partner' | 'channel' | 'peer' | 'unknown'

export type SignalKind = 'reaction' | 'comment' | 'job_change' | 'funding' | 'post_intent'

export type Tier = 'act_now' | 'keep_warm' | 'nurture' | 'parked'

export interface Contact {
  id: string
  user_id: string
  name: string
  role_title: string | null
  company: string | null
  linkedin_url: string | null
  email: string | null
  contact_type: ContactType
  stage: Stage
  last_touch_at: string | null
  created_at: string
}

export interface Signal {
  id: string
  contact_id: string
  kind: SignalKind
  detail: string | null
  occurred_at: string
  handled_at: string | null
  created_at: string
}

export interface Note {
  id: string
  contact_id: string
  body: string
  channel: string
  created_at: string
}

export interface StageEvent {
  id: string
  contact_id: string
  from_stage: Stage | null
  to_stage: Stage
  created_at: string
}

export interface AppUser {
  id: string
  name: string
  headline: string | null
  looking_for: string | null
  pulse_actionable_kinds: SignalKind[]
  notify_kinds: SignalKind[]
  notify_contact_ids: string[]
}

// The contact_score Postgres view — see db/schema.sql. Never reimplement
// this scoring logic in TypeScript; only read it.
export interface ContactScore {
  id: string
  user_id: string
  score: number
  recent_signals: number
  open_events: number
  last_signal_at: string | null
  tier: Tier
}

export interface ContactWithScore extends Contact {
  score: ContactScore | null
}

// Shape returned by a Supabase embedded select of signal -> contact,
// e.g. .select('*, contact!inner(id, name, company, stage)')
export interface SignalWithContact extends Signal {
  contact: Pick<Contact, 'id' | 'name' | 'company' | 'stage'>
}

// A client-side simulated notification. Never persisted to Supabase — it
// lives in localStorage via notificationStore.ts.
export interface SimNotification {
  id: string
  contactId: string
  contactName: string
  company: string | null
  kind: SignalKind
  detail: string
  at: number
  unread: boolean
}
