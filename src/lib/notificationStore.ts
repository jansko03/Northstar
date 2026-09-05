import type { SimNotification } from './types'

// Simulated notifications live here rather than in component state so the
// Admin "Populate Pulse" button and the Pulse feed can share one list.
// localStorage keeps them across a reload; nothing here touches Supabase.
const STORAGE_KEY = 'northstar.simulated-notifications'
const MAX_STORED = 8

export interface StoredNotifications {
  /** Start of the clock hour these belong to; a newer hour discards them. */
  hour: number
  items: SimNotification[]
}

const EMPTY: StoredNotifications = { hour: 0, items: [] }

const listeners = new Set<() => void>()
// useSyncExternalStore compares snapshots by reference, so the parsed value is
// cached and only replaced on an actual write.
let cache: StoredNotifications | null = null

function parse(raw: string | null): StoredNotifications {
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as StoredNotifications
    if (typeof parsed?.hour !== 'number' || !Array.isArray(parsed.items)) return EMPTY
    return parsed
  } catch {
    return EMPTY
  }
}

function load(): StoredNotifications {
  try {
    return parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    // Private mode or blocked storage — fall back to in-memory only.
    return EMPTY
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function write(next: StoredNotifications) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore: the in-memory cache still drives this tab.
  }
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  // Another tab wrote — drop the cache so the next snapshot re-reads.
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    cache = null
    emit()
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function getSnapshot(): StoredNotifications {
  cache ??= load()
  return cache
}

/** Server snapshot for SSR/hydration — always the same reference. */
export function getServerSnapshot(): StoredNotifications {
  return EMPTY
}

/** Adds items newest-first, discarding anything from an earlier hour. */
export function pushNotifications(hour: number, items: SimNotification[]) {
  if (items.length === 0) return
  const current = getSnapshot()
  const existing = current.hour === hour ? current.items : []
  write({ hour, items: [...items, ...existing].slice(0, MAX_STORED) })
}

export function markStoredRead() {
  const current = getSnapshot()
  if (!current.items.some((n) => n.unread)) return
  write({ ...current, items: current.items.map((n) => ({ ...n, unread: false })) })
}
