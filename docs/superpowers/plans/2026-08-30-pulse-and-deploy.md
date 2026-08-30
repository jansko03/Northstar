# Pulse Screen + Web Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the last unbuilt screen on the CLAUDE.md roadmap (`/pulse`) and get the app deployed and reachable on the public web.

**Architecture:** `/pulse` is a single screen component (`src/screens/Pulse.tsx`) that fetches `signal` rows joined to their `contact` via Supabase's embedded-resource syntax, splits unhandled signals into three kind-based columns, and lists the last 7 days of all signals in a table below. Deployment wires the existing GitHub repo to Vercel with a static SPA rewrite so client-side routes survive a page refresh.

**Tech Stack:** React 19 + react-router-dom 7, Supabase JS client, Vite build, Vercel hosting. No new dependencies.

**Spec:** No separate spec file — this is a bounded task per the brainstorming skill (extends an existing, fully-established codebase; no new subsystems). The agreed design was approved in chat and is captured in full in the Global Constraints and task bodies below.

## Global Constraints

- Every table has `user_id` scoping via `DEFAULT_USER_ID` (`src/lib/supabase.ts`) — every new query must filter by it. Never remove or bypass this.
- Never reimplement `contact_score` scoring logic in TypeScript — this screen only reads `signal`/`contact`, it doesn't touch scoring.
- No CSS framework, no component library, no state manager beyond React state/hooks. Inline styles using the tokens in `src/lib/tokens.ts`.
- TypeScript strict, no `any`.
- Dark UI visual language from `src/lib/tokens.ts`: background `color.bg`, surfaces `color.surface` with `color.border`, radius via `radius.sm`/`radius.lg`, `label` style for all-caps mono headers, `font.body`/`font.mono`.
- **No test framework exists in this repo** (no vitest/jest, no `test` script in `package.json`). Every prior screen (`Network.tsx`, `ContactDetail.tsx`, `Import.tsx`, `Profile.tsx`) was verified by hand against `db/seed.sql` data in the dev server, per CLAUDE.md's rule to test UI changes in a browser before calling them done. This plan follows the same pattern — "write a test" steps are replaced with "run the dev server and check X" steps using the known seed-data shape below.
- Seed data (`db/seed.sql`) reality you'll verify against: unhandled signals are Peter Horváth/David Cohen (`job_change`), Marco Ferrari (`funding`), Chen Wei/Barbora Poláková (`post_intent`) — 2/1/2 respectively. Lukas Weber (`job_change`) and Isabel Santos (`funding`) are already handled and must NOT appear. Within the last 7 days: Peter Horváth (`job_change`, 5d ago), Barbora Poláková (`post_intent`, 3d ago), and Sophie Laurent (`reaction`, 6d ago) should show in the week table.

---

### Task 1: Types and labels for Pulse

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/tokens.ts`

**Interfaces:**
- Produces: `SignalWithContact` type (exported from `types.ts`) — `Signal & { contact: Pick<Contact, 'id' | 'name' | 'company' | 'stage'> }`. Later tasks fetch this shape directly from Supabase's embedded select.
- Produces: `kindLabel: Record<SignalKind, string>` (exported from `tokens.ts`) — human-readable labels for each signal kind.

- [ ] **Step 1: Add `SignalWithContact` to `src/lib/types.ts`**

Add at the end of the file, after `ContactWithScore`:

```ts
// Shape returned by a Supabase embedded select of signal -> contact,
// e.g. .select('*, contact!inner(id, name, company, stage)')
export interface SignalWithContact extends Signal {
  contact: Pick<Contact, 'id' | 'name' | 'company' | 'stage'>
}
```

- [ ] **Step 2: Add `kindLabel` to `src/lib/tokens.ts`**

Change the type-only import at the top of the file:

```ts
import type { SignalKind, Stage, Tier } from './types'
```

Add after `tierColor` at the end of the file:

```ts
export const kindLabel: Record<SignalKind, string> = {
  reaction: 'Reaction',
  comment: 'Comment',
  job_change: 'Job Change',
  funding: 'Funding',
  post_intent: 'Post Intent',
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (this only adds a type and a const map, nothing consumes them yet, so there should be zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/tokens.ts
git commit -m "Add SignalWithContact type and kindLabel map for Pulse"
```

---

### Task 2: Build the Pulse screen

**Files:**
- Create: `src/screens/Pulse.tsx`

**Interfaces:**
- Consumes: `SignalWithContact` and `kindLabel` from Task 1; `color`, `font`, `label`, `radius`, `surfaceGradient`, `cardShadow`, `stageColor` from `src/lib/tokens.ts`; `initials`, `daysAgo` from `src/lib/format.ts`; `Section` from `src/components/Section.tsx`; `supabase`, `DEFAULT_USER_ID` from `src/lib/supabase.ts`.
- Produces: `export function Pulse()` — a screen component with no props, used directly as a route element in Task 3.

- [ ] **Step 1: Write the data-fetching part of the component**

Create `src/screens/Pulse.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../components/Section'
import { daysAgo, initials } from '../lib/format'
import { supabase, DEFAULT_USER_ID } from '../lib/supabase'
import { cardShadow, color, font, kindLabel, label, radius, surfaceGradient } from '../lib/tokens'
import type { SignalKind, SignalWithContact } from '../lib/types'

const actionableKinds: SignalKind[] = ['job_change', 'funding', 'post_intent']

export function Pulse() {
  const [openSignals, setOpenSignals] = useState<SignalWithContact[]>([])
  const [weekSignals, setWeekSignals] = useState<SignalWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

    const [openRes, weekRes] = await Promise.all([
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', DEFAULT_USER_ID)
        .is('handled_at', null)
        .in('kind', actionableKinds)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', DEFAULT_USER_ID)
        .gte('occurred_at', weekAgo)
        .order('occurred_at', { ascending: false }),
    ])

    if (openRes.error) {
      setError(openRes.error.message)
      setLoading(false)
      return
    }
    if (weekRes.error) {
      setError(weekRes.error.message)
      setLoading(false)
      return
    }

    setOpenSignals(openRes.data as unknown as SignalWithContact[])
    setWeekSignals(weekRes.data as unknown as SignalWithContact[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function markHandled(signalId: string) {
    setOpenSignals((prev) => prev.filter((s) => s.id !== signalId))
    await supabase.from('signal').update({ handled_at: new Date().toISOString() }).eq('id', signalId)
  }

  const columns = useMemo(
    () => ({
      job_change: openSignals.filter((s) => s.kind === 'job_change'),
      funding: openSignals.filter((s) => s.kind === 'funding'),
      post_intent: openSignals.filter((s) => s.kind === 'post_intent'),
    }),
    [openSignals],
  )

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <span style={{ ...label, color: color.lime }}>Could not load signals: {error}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {actionableKinds.map((kind) => (
          <PulseColumn key={kind} kind={kind} signals={columns[kind]} onDone={markHandled} />
        ))}
      </div>
      <WeekTable signals={weekSignals} />
    </div>
  )
}

function PulseColumn({
  kind,
  signals,
  onDone,
}: {
  kind: SignalKind
  signals: SignalWithContact[]
  onDone: (id: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: surfaceGradient,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        boxShadow: cardShadow,
        minHeight: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, color: color.muted }}>{kindLabel[kind]}</span>
        <span style={{ ...label, color: color.accent }}>{signals.length}</span>
      </div>
      {signals.length === 0 && (
        <span style={{ fontSize: 13, color: color.dim }}>Nothing here.</span>
      )}
      {signals.map((s) => (
        <SignalCard key={s.id} signal={s} onDone={onDone} />
      ))}
    </div>
  )
}

function SignalCard({ signal, onDone }: { signal: SignalWithContact; onDone: (id: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.sm,
      }}
    >
      <Link
        to={`/contact/${signal.contact.id}`}
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: color.text }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: color.surface,
            border: `1px solid ${color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.mono,
            fontSize: 11,
            color: color.accent,
            flexShrink: 0,
          }}
        >
          {initials(signal.contact.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: font.body, fontSize: 13.5, fontWeight: 500 }}>{signal.contact.name}</div>
          {signal.contact.company && (
            <div style={{ fontSize: 11.5, color: color.muted }}>{signal.contact.company}</div>
          )}
        </div>
      </Link>
      {signal.detail && <div style={{ fontSize: 12.5, color: color.muted, lineHeight: 1.4 }}>{signal.detail}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ ...label, color: color.dim, fontSize: 9.5 }}>{daysAgo(signal.occurred_at)}</span>
        <button
          type="button"
          onClick={() => onDone(signal.id)}
          style={{
            ...label,
            padding: '6px 10px',
            background: 'rgba(79,227,155,.11)',
            border: '1px solid rgba(79,227,155,.34)',
            borderRadius: radius.sm - 6,
            color: color.accent,
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function WeekTable({ signals }: { signals: SignalWithContact[] }) {
  return (
    <Section title="This week">
      {signals.length === 0 ? (
        <span style={{ fontSize: 13, color: color.dim }}>No signals in the last 7 days.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signals.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ ...label, color: color.dim, width: 90, flexShrink: 0 }}>
                {new Date(s.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <Link to={`/contact/${s.contact.id}`} style={{ ...label, color: color.text, width: 160, flexShrink: 0, textDecoration: 'none' }}>
                {s.contact.name}
              </Link>
              <span style={{ ...label, color: color.accent, width: 100, flexShrink: 0 }}>{kindLabel[s.kind]}</span>
              <span style={{ fontSize: 13, color: color.muted }}>{s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. `Pulse` is not yet routed, so an unused-export lint warning (if any) is fine — it will be consumed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Pulse.tsx
git commit -m "Build Pulse screen: unhandled-signal columns and week table"
```

---

### Task 3: Wire the route and retire the Todo stub

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/screens/Todo.tsx`

**Interfaces:**
- Consumes: `Pulse` from `src/screens/Pulse.tsx` (Task 2).

- [ ] **Step 1: Swap the route in `src/App.tsx`**

Replace the `Todo` import:

```ts
import { Todo } from './screens/Todo'
```

with:

```ts
import { Pulse } from './screens/Pulse'
```

Replace the route:

```tsx
<Route path="/pulse" element={<Todo name="Pulse" />} />
```

with:

```tsx
<Route path="/pulse" element={<Pulse />} />
```

- [ ] **Step 2: Delete the now-unused Todo stub**

`src/screens/Todo.tsx` was only referenced by the `/pulse` route. Confirm nothing else references it, then delete it:

```bash
grep -rn "screens/Todo\|from '../screens/Todo'\|Todo(" src
```

Expected: no matches outside the file itself. Delete the file.

- [ ] **Step 3: Run the dev server and verify against seed data**

Run: `npm run dev`, open the printed local URL, click **Pulse** in the nav.

Expected, per the seed data noted in Global Constraints:
- **Job Change** column shows 2 cards (Peter Horváth, David Cohen) — NOT Lukas Weber (already handled).
- **Funding** column shows 1 card (Marco Ferrari) — NOT Isabel Santos (already handled).
- **Post Intent** column shows 2 cards (Chen Wei, Barbora Poláková).
- Clicking a card's contact name/avatar navigates to `/contact/:id`.
- Clicking **Done** on any card removes it from its column immediately.
- **This week** section lists Peter Horváth (job_change), Barbora Poláková (post_intent), and Sophie Laurent (reaction) — refresh the page after clicking Done on one of these and confirm it now shows `handled_at` set (the row still appears in the week table, since that table is not filtered by handled state) but no longer appears in its column.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git rm src/screens/Todo.tsx
git commit -m "Route /pulse to the built Pulse screen, remove Todo stub"
```

---

### Task 4: Prepare and verify the production build

**Files:**
- Create: `vercel.json`

**Interfaces:**
- None — this is a config-only task with no code interfaces.

- [ ] **Step 1: Add the SPA rewrite config**

Create `vercel.json` in the project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This makes every path (e.g. a hard refresh on `/contact/<id>`) serve `index.html` so `react-router-dom`'s client-side router can take over, instead of Vercel returning a 404 for a path with no matching static file.

- [ ] **Step 2: Run a full production build locally**

Run: `npm run build`
Expected: succeeds and produces a `dist/` folder. This is the exact command Vercel will run, so a failure here is a failure on Vercel too.

- [ ] **Step 3: Smoke-test the production build locally**

Run: `npm run preview`, open the printed URL, and check:
- `/network`, `/import`, `/pulse`, `/profile` all load.
- Navigate to any `/contact/:id` from the network grid, then hard-refresh the browser on that URL — it should still show the contact, not a blank page or error (this is what `vercel.json`'s rewrite will guarantee once deployed; `vite preview` serves history-mode routes correctly on its own, so this step is really about catching any other build-only issue, e.g. an env var not being embedded).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "Add Vercel SPA rewrite config for deployment"
```

---

### Task 5: Connect the repo to Vercel and deploy

**Files:** none (account/dashboard steps — nothing in the repo changes beyond what Task 4 already committed).

This task is manual because it requires your Vercel account login, which an agent cannot do on your behalf.

- [ ] **Step 1: Push the branch**

```bash
git push origin master
```

- [ ] **Step 2: Import the project on Vercel**

Go to vercel.com, sign in (GitHub login is simplest since the repo is already on GitHub), click **Add New → Project**, and select `jansko03/Northstar`.

- [ ] **Step 3: Confirm build settings**

Vercel auto-detects Vite. Confirm:
- Build command: `npm run build`
- Output directory: `dist`

No environment variables need to be added — `.env.local` is committed to this repo on purpose (see the comment at the top of that file), so Vite embeds the Supabase URL/anon key at build time automatically.

- [ ] **Step 4: Deploy and verify**

Click **Deploy**. Once it finishes, open the given `*.vercel.app` URL and check the same things as Task 4 Step 3 (all four screens load, a hard refresh on a `/contact/:id` URL works — this is what confirms `vercel.json`'s rewrite is active in production).

- [ ] **Step 5: Confirm auto-deploy on push**

Make a trivial change (or just note this for next time): every future `git push origin master` will trigger a new Vercel deployment automatically. No further action needed.
