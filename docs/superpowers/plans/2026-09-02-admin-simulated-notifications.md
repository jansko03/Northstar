# Admin Simulated Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user watchlist specific contacts on `/admin` ("notify me about this person no matter what"), and add a self-updating, purely client-side simulated notification feed to `/admin` that fabricates plausible events from the current (even unsaved) notification settings.

**Architecture:** One new `uuid[]` column on `app_user` (`notify_contact_ids`) persists the watchlist alongside the existing kind toggles. `Admin.tsx` grows two new `Section`s: a contact search-and-add picker with removable chips, and a `SimulatedFeed` subcomponent that fabricates events client-side on a 5-second timer from two pools (general: any contact + a checked notification kind; watchlist: any watchlisted contact + any kind) — no writes to the `signal` table, so real Pulse/scoring data is untouched.

**Tech Stack:** React 19, TypeScript (strict), Vite, react-router-dom 7, Supabase. No test framework in this repo — verification is `npm run build`, `npm run lint`, and manual browser checks.

**Spec:** `docs/superpowers/specs/2026-09-02-admin-simulated-notifications-design.md`

## Global Constraints

- No CSS framework. Inline styles or `src/lib/tokens.ts` only — no new `.css` files.
- No component library, no state manager beyond React state + hooks.
- TypeScript strict. No `any`.
- No test framework introduced. Verification is `npm run build` + `npm run lint` + manual browser check.
- Single user, no auth — `id` columns untouched.
- No real notification delivery (email/push/toast outside `/admin`) — this plan is explicitly UI-only simulation, per the spec's Out of Scope section.
- The simulated feed must never write to the `signal` table — it is pure client-side fabrication, so `contact_score` and `/pulse`/`/network` stay provably unaffected.
- `db/schema.sql` is hand-run against Supabase (no migration tooling) — any schema change needs a corresponding statement run against the live database, not just a file edit.

---

### Task 1: `notify_contact_ids` column + type

**Files:**
- Modify: `db/schema.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `AppUser.notify_contact_ids: string[]`, consumed by Task 2's `Admin.tsx` load/save code.

- [ ] **Step 1: Add the column to the `create table app_user` block**

In `db/schema.sql`, find the `create table app_user (...)` block (currently ending with the `notify_kinds` column) and add a new column after `notify_kinds`:

```sql
  notify_kinds text[] not null default array['comment']
    check (notify_kinds <@ array['reaction','comment','job_change','funding','post_intent']),
  notify_contact_ids uuid[] not null default array[]::uuid[]
);
```

(Only the `notify_contact_ids` line and the closing `)` are new — `notify_kinds`'s existing lines are shown for anchoring, don't duplicate them.)

- [ ] **Step 2: Add a live-DB migration statement**

In the same file, in the commented migration block (the one with `alter table app_user add column notify_kinds ...`), add a new commented block after it:

```sql
-- alter table app_user
--   add column notify_contact_ids uuid[] not null default array[]::uuid[];
```

- [ ] **Step 3: Run the migration against the live database**

If you have access to the project's Supabase SQL editor this session (as in prior sessions for this project), run directly:

```sql
alter table app_user
  add column notify_contact_ids uuid[] not null default array[]::uuid[];
```

Verify with:

```sql
select notify_contact_ids from app_user;
```

Expected: `{}` (empty array) for the existing row. If you do not have that access, tell the user to run both statements themselves and report back before continuing to Task 2 (Task 2's manual verification depends on the column existing).

- [ ] **Step 4: Add the field to `AppUser`**

In `src/lib/types.ts`, replace:

```ts
export interface AppUser {
  id: string
  name: string
  headline: string | null
  looking_for: string | null
  pulse_actionable_kinds: SignalKind[]
  notify_kinds: SignalKind[]
}
```

with:

```ts
export interface AppUser {
  id: string
  name: string
  headline: string | null
  looking_for: string | null
  pulse_actionable_kinds: SignalKind[]
  notify_kinds: SignalKind[]
  notify_contact_ids: string[]
}
```

- [ ] **Step 5: Verify**

Run: `npm run build` — expected exit 0.

- [ ] **Step 6: Commit**

```bash
git add db/schema.sql src/lib/types.ts
git commit -m "feat: add notify_contact_ids column for per-contact notification watchlist"
```

---

### Task 2: Contact watchlist UI

**Files:**
- Modify: `src/screens/Admin.tsx`

**Interfaces:**
- Consumes: `AppUser.notify_contact_ids` (Task 1); `useContactsWithScore(): { contacts: ContactWithScore[]; loading: boolean; error: string | null }` from `src/lib/useContactsWithScore.ts` (already exists, used identically by `Network.tsx` and `Profile.tsx`); `ContactWithScore` type from `src/lib/types.ts` (already exists — has `.id`, `.name`, `.company`).
- Produces: `watchlist: ContactWithScore[]` (derived from `contacts` + `notifyContactIds`), consumed by Task 3's `SimulatedFeed`.

- [ ] **Step 1: Replace the full contents of `src/screens/Admin.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { color, font, kindLabel, label, radius } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
import type { SignalKind } from '../lib/types'

const ALL_KINDS: SignalKind[] = ['reaction', 'comment', 'job_change', 'funding', 'post_intent']

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
  // (e.g. typing in the search box) — SimulatedFeed's effect (Task 3) depends
  // on this array by reference, and an unstable reference would restart its
  // timer on every keystroke. Placed before the loading early-return below
  // since hooks can't be called after a conditional return.
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
        background: 'rgba(79,227,155,.08)',
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
          background: 'rgba(79,227,155,.16)',
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
```

This is the entire file. `ContactWithScore` is NOT imported yet — `contacts`/`watchlist` rely on inference from `useContactsWithScore()`'s return type, with no explicit type annotation needed here. TypeScript's `noUnusedLocals` (part of this repo's strict config) errors on an unused type import, so importing it now (before Task 3 uses it by name) would break the build. Task 3 adds the import when `SimulatedFeed`'s props need it explicitly.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build` — expected exit 0.

Run: `npm run lint` — expected exit 0, no new warnings beyond the pre-existing unrelated one in `Pulse.tsx`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, visit `/admin`.

Confirm: a new "Watchlist" card appears (third card in the grid). Typing a contact's name into its search box shows up to 6 matching rows below it; clicking one adds them as a green removable chip below and clears the search box; clicking a chip's × removes them. Click Save, reload the page — the watchlist persists.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Admin.tsx
git commit -m "feat: add contact watchlist to Admin notification settings"
```

---

### Task 3: Simulated notification feed

**Files:**
- Modify: `src/screens/Admin.tsx`

**Interfaces:**
- Consumes: `notifyKinds: SignalKind[]`, `watchlist: ContactWithScore[]`, `contacts: ContactWithScore[]` — all already exist in `Admin()` from Task 2.
- Produces: no new exports — `SimulatedFeed` and `SimEvent` are local to this file.

- [ ] **Step 1: Import `ContactWithScore` and add the `PHRASES` constant**

In `src/screens/Admin.tsx`, change the type-only import (currently `import type { SignalKind } from '../lib/types'`) to also bring in `ContactWithScore`, which `SimulatedFeed`'s props reference explicitly in Step 3 below (it wasn't imported in Task 2 because it would have been an unused-import build error until this step uses it by name):

```tsx
import type { ContactWithScore, SignalKind } from '../lib/types'
```

Then add this constant after the `ALL_KINDS` constant:

```tsx
const PHRASES: Record<SignalKind, string[]> = {
  reaction: ['Liked your post about pricing strategy', 'Reacted to your product update'],
  comment: ['Commented on your roadmap post', 'Left a comment asking about your services'],
  job_change: ['Changed jobs to a new company', 'Started a new role'],
  funding: ['Announced a new funding round', 'Their company raised a Series A'],
  post_intent: ['Asked the network for recommendations', 'Posted looking for a consultant'],
}
```

- [ ] **Step 2: Add a "Simulated notifications" `Section` to the grid**

In the JSX returned by `Admin()`, add a fourth `Section` right after the "Watchlist" `Section` (still inside the same grid `<div>`):

```tsx
        <Section title="Simulated notifications">
          <SimulatedFeed notifyKinds={notifyKinds} watchlist={watchlist} contacts={contacts} />
        </Section>
```

- [ ] **Step 3: Add the `SimEvent` type and `SimulatedFeed` component**

Add at the end of the file, after `ContactChip`:

```tsx
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
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run build` — expected exit 0.

Run: `npm run lint` — expected exit 0, no new warnings.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/admin`.

With no Notification kinds checked and an empty watchlist: confirm the "Simulated notifications" card shows "Enable a kind or watch someone to see notifications here." and never ticks.

Check a Notification kind (e.g. Job Change) without saving: within ~5-10 seconds, confirm fabricated events start appearing, each showing a real contact name, the kind label, a canned phrase, and a timestamp — using contacts from your real contact list, with kinds limited to the ones you checked.

Uncheck all kinds and instead add someone to the Watchlist: confirm events resume, now always naming that watchlisted person but with kinds spanning all five (not just previously-checked ones).

With both a kind checked and someone watchlisted: confirm events draw from both (mix of the watchlisted person with any kind, and other contacts with only the checked kinds) over enough ticks.

Confirm `/pulse` and `/network` are unaffected by leaving `/admin` open and ticking for a while (no new real signals, no count changes) — proving the feed is purely client-side and never touches the `signal` table.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Admin.tsx
git commit -m "feat: add simulated notification feed to Admin"
```
