import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  getServerSnapshot,
  getSnapshot,
  markStoredRead,
  pushNotifications,
  subscribe,
} from './notificationStore'
import type { ContactWithScore, SignalKind, SimNotification } from './types'

export const ALL_KINDS: SignalKind[] = ['reaction', 'comment', 'job_change', 'funding', 'post_intent']

export const PHRASES: Record<SignalKind, string[]> = {
  reaction: ['Liked your post about pricing strategy', 'Reacted to your product update'],
  comment: ['Commented on your roadmap post', 'Left a comment asking about your services'],
  job_change: ['Changed jobs to a new company', 'Started a new role'],
  funding: ['Announced a new funding round', 'Their company raised a Series A'],
  post_intent: ['Asked the network for recommendations', 'Posted looking for a consultant'],
}

// Deliberately quiet: a small baseline so the feed is never empty, a slow drip
// on top, and a hard cap per hour. Everything resets at the top of each clock
// hour, so the list can't grow without bound.
const BASELINE_COUNT = 4
const MAX_ARRIVALS_PER_HOUR = 6
const DRIP_MIN_MS = 90_000
const DRIP_MAX_MS = 180_000
const MAX_VISIBLE = 8
// Window the baseline timestamps are scattered over, ending at the seed time.
const BASELINE_SPAN_MS = 45 * 60_000

export interface Pools {
  watchlist: ContactWithScore[]
  general: ContactWithScore[]
  generalKinds: SignalKind[]
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function hourStartOf(ms: number): number {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

/** Milliseconds from `now` until the start of the next clock hour. */
function msUntilNextHour(now: number): number {
  const next = new Date(hourStartOf(now))
  next.setHours(next.getHours() + 1)
  return next.getTime() - now
}

export function buildPools(
  contacts: ContactWithScore[],
  notifyKinds: SignalKind[],
  notifyContactIds: string[],
): Pools {
  return {
    watchlist: contacts.filter((c) => notifyContactIds.includes(c.id)),
    general: contacts.filter((c) => !notifyContactIds.includes(c.id)),
    generalKinds: notifyKinds,
  }
}

/** False when there is nobody to notify about — no kinds selected, no watchlist. */
export function poolsConfigured(pools: Pools): boolean {
  return pools.watchlist.length > 0 || (pools.general.length > 0 && pools.generalKinds.length > 0)
}

/**
 * Watchlisted people are worth hearing about whatever they do; everyone else
 * only produces the kinds selected in Admin.
 */
function makeNotification(pools: Pools, at: number, unread: boolean): SimNotification | null {
  const hasWatch = pools.watchlist.length > 0
  const hasGeneral = pools.general.length > 0 && pools.generalKinds.length > 0
  if (!hasWatch && !hasGeneral) return null

  const useWatch = hasWatch && hasGeneral ? Math.random() < 0.5 : hasWatch
  const contact = useWatch ? pick(pools.watchlist) : pick(pools.general)
  const kind = useWatch ? pick(ALL_KINDS) : pick(pools.generalKinds)

  return {
    id: `${at}-${Math.random()}`,
    contactId: contact.id,
    contactName: contact.name,
    company: contact.company,
    kind,
    detail: pick(PHRASES[kind]),
    at,
    unread,
  }
}

/**
 * `count` unread notifications timestamped now, newest first. Used by the drip
 * and by the Admin populate button.
 */
export function generateNotifications(pools: Pools, count: number, now = Date.now()): SimNotification[] {
  return Array.from({ length: count }, (_, i) => makeNotification(pools, now - i, true)).filter(
    (n): n is SimNotification => n !== null,
  )
}

/**
 * The already-read items each hour starts with, back-dated to scattered
 * minutes before the seed time so the feed is never empty.
 */
function seedBaseline(pools: Pools, seededAt: number): SimNotification[] {
  return Array.from({ length: BASELINE_COUNT }, (_, i) => {
    const age = Math.round((BASELINE_SPAN_MS * (i + 1)) / (BASELINE_COUNT + 1))
    return makeNotification(pools, seededAt - age, false)
  }).filter((n): n is SimNotification => n !== null)
}

export interface SimulatedNotifications {
  notifications: SimNotification[]
  unreadCount: number
  markAllRead: () => void
  /** False when Admin has no notify kinds and no watchlist — nothing to simulate. */
  configured: boolean
}

/**
 * Client-side only — nothing here is written to Supabase. The array arguments
 * must be reference-stable (they come straight from state or module
 * constants); a new array every render would restart the simulation.
 */
export function useSimulatedNotifications(
  contacts: ContactWithScore[],
  notifyKinds: SignalKind[],
  notifyContactIds: string[],
): SimulatedNotifications {
  // `seededAt` is captured with the hour so the baseline stays a pure
  // computation — no clock reads during render.
  const [hour, setHour] = useState(() => {
    const now = Date.now()
    return { start: hourStartOf(now), seededAt: now }
  })

  // Arrivals live in the shared store so Admin's populate button can add to
  // the same list this feed renders.
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const pools = useMemo(
    () => buildPools(contacts, notifyKinds, notifyContactIds),
    [contacts, notifyKinds, notifyContactIds],
  )
  const configured = poolsConfigured(pools)

  // Derived, not stored: recomputed only when the pools or the hour change.
  const baseline = useMemo(() => seedBaseline(pools, hour.seededAt), [pools, hour.seededAt])

  const arrivals = stored.hour === hour.start ? stored.items : []

  // Aligned to the wall clock rather than to mount time, so the reset lands on
  // the hour however long the tab has been open.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function scheduleReset() {
      timer = setTimeout(() => {
        const now = Date.now()
        setHour({ start: hourStartOf(now), seededAt: now })
        scheduleReset()
      }, msUntilNextHour(Date.now()))
    }

    scheduleReset()
    return () => clearTimeout(timer)
  }, [])

  // The per-hour cap counts automatic arrivals only; the Admin button is a
  // deliberate action and bypasses it. Restarting on `hour.start` resets it.
  useEffect(() => {
    if (!configured) return

    let dripped = 0
    let timer: ReturnType<typeof setTimeout>

    function scheduleDrip() {
      timer = setTimeout(
        () => {
          if (dripped < MAX_ARRIVALS_PER_HOUR) {
            const now = Date.now()
            const next = generateNotifications(pools, 1, now)
            if (next.length > 0) {
              dripped += 1
              pushNotifications(hourStartOf(now), next)
            }
          }
          scheduleDrip()
        },
        DRIP_MIN_MS + Math.random() * (DRIP_MAX_MS - DRIP_MIN_MS),
      )
    }

    scheduleDrip()
    return () => clearTimeout(timer)
  }, [pools, configured, hour.start])

  return {
    notifications: [...arrivals, ...baseline].slice(0, MAX_VISIBLE),
    unreadCount: arrivals.filter((n) => n.unread).length,
    markAllRead: markStoredRead,
    configured,
  }
}
