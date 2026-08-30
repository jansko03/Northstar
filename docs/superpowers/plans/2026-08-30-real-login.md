# Real Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Northstar's hardcoded single-user id with a real Supabase Auth session (magic-link email login), and actually lock the database down with Row Level Security — today the anon key can read/write everything with no login at all.

**Architecture:** A small `AuthContext`/`useAuth()` hook tracks the Supabase Auth session; `App.tsx` renders a new `Welcome` screen (pitch + magic-link email form) instead of the app whenever there's no session. Once a session exists, every place that currently hardcodes `DEFAULT_USER_ID` switches to the logged-in user's real id. The existing single seeded account is re-pointed to that real id via one-time hand-run SQL, then RLS policies keyed on `auth.uid()` are enabled on every table (with a `security_invoker` fix on the `contact_score` view, since Postgres views bypass RLS by default).

**Tech Stack:** React 19 + react-router-dom 7, `@supabase/supabase-js` (already a dependency — Supabase Auth is part of the same client, no new package), Vite build, plain Postgres/SQL (`db/schema.sql`, hand-applied to the live Supabase project — no migration tooling exists in this repo).

**Spec:** `docs/superpowers/specs/2026-08-30-real-login-design.md`

## Global Constraints

- Single real account, not multi-tenant — no general sign-up flow, ever (spec decision 1, 5).
- Magic link (email OTP) only — no password field, no OAuth (spec decision 2).
- RLS is the actual security boundary; the `Welcome` screen alone would be cosmetic (spec decision 3).
- `contact_score` needs `alter view contact_score set (security_invoker = true);` once RLS exists, or the view silently bypasses RLS (spec decision 4).
- No CSS framework, no component library, no state manager beyond React state + a couple of hooks (`AuthContext` follows the same pattern as the existing `useIsMobile()`/`useContactsWithScore()` hooks).
- TypeScript strict, no `any`.
- Dark UI, existing visual language from `src/lib/tokens.ts` — `color`, `font`, `label`, `radius`, `surfaceGradient`, `cardShadow`.
- **No test framework exists in this repo** (no vitest/jest, no `test` script in `package.json`). Every task's verification is `npm run build` (type-check) plus a manual check against the dev server and, where noted, the real Supabase project — same pattern every prior plan in this repo uses.
- **No migration tooling.** `db/schema.sql` is the source of truth for a fresh install; the *running* Supabase database is updated by hand via the Supabase SQL editor. Every DB-changing step says exactly what to paste there.
- `db/seed.sql` is explicitly **out of scope** for this plan — it hardcodes the old fixed user id and will need separate attention (by whoever next uses it) after this ships. Don't touch it.

---

### Task 1: Add `AuthContext` and the `useAuth()` hook

**Files:**
- Create: `src/lib/AuthContext.tsx`

**Interfaces:**
- Produces: `AuthProvider` (a component wrapping `children: ReactNode`) and `useAuth(): { user: User | null; session: Session | null; loading: boolean; signOut: () => Promise<void> }`. Task 2 wraps `App.tsx` in `AuthProvider` and reads `user`/`loading` to gate routes; Task 3 reads `signOut`; Task 5 reads `user` in place of `DEFAULT_USER_ID`.

This task has no consumer yet — it's pure plumbing, wired in by Task 2. Verification here is limited to a successful build; the hook's actual behavior (does a session appear after login, does sign-out clear it) is verified end-to-end once Task 2 renders something that uses it.

- [ ] **Step 1: Write `AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: succeeds with no TypeScript errors. (`AuthProvider`/`useAuth` aren't imported anywhere yet, so this only checks the file itself is valid — that's expected at this stage.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/AuthContext.tsx
git commit -m "Add AuthContext and useAuth hook"
```

---

### Task 2: Add the `Welcome` screen, gate the app on session, configure Supabase Auth, and log in for real

**Files:**
- Create: `src/screens/Welcome.tsx`
- Modify: `src/App.tsx` (full file, 37 lines)

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth()` (Task 1).
- Produces: the app now renders nothing but `Welcome` when there's no session — Task 3 (sign-out) and Task 5 (removing `DEFAULT_USER_ID`) both depend on a session existing before their code paths ever run.

This task also includes non-code steps (Supabase dashboard configuration) because the code can't be verified without them — there's no way to test "does the magic link actually log me in" without a configured Auth provider and redirect URLs.

- [ ] **Step 1: Write `Welcome.tsx`**

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { cardShadow, color, font, label, radius, surfaceGradient } from '../lib/tokens'

export function Welcome() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  const canSubmit = status !== 'sending' && !!email.trim()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: color.bg,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          padding: 32,
          background: surfaceGradient,
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: cardShadow,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color.accent,
                boxShadow: '0 0 14px 2px rgba(79,227,155,.55)',
              }}
            />
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 15,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: color.text,
              }}
            >
              Northstar
            </span>
          </div>
          <span style={{ fontSize: 14, color: color.muted, lineHeight: 1.5 }}>
            Who should I contact this week, and why.
          </span>
        </div>

        {status === 'sent' ? (
          <div style={{ ...label, color: color.accent, textAlign: 'center', lineHeight: 1.7 }}>
            Check {email} for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                padding: '11px 13px',
                color: color.text,
                fontFamily: font.body,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                ...label,
                padding: '12px',
                textAlign: 'center',
                background: canSubmit ? color.accent : color.surface,
                border: `1px solid ${canSubmit ? color.accent : color.border}`,
                borderRadius: radius.sm,
                color: canSubmit ? '#080908' : color.dim,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {status === 'error' && errorMessage && (
              <span style={{ ...label, color: color.lime }}>{errorMessage}</span>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `App.tsx` to gate on session**

`src/App.tsx` currently reads:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MOBILE_BOTTOM_NAV_HEIGHT, NavBar } from './components/NavBar'
import { useIsMobile } from './lib/useIsMobile'
import { ContactDetail } from './screens/ContactDetail'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Profile } from './screens/Profile'
import { Pulse } from './screens/Pulse'

function App() {
  const isMobile = useIsMobile()

  return (
    <BrowserRouter>
      <NavBar />
      <div
        style={{
          paddingBottom: isMobile
            ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
            : 0,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/network" replace />} />
          <Route path="/network" element={<Network />} />
          <Route path="/import" element={<Import />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/contact/:id" element={<ContactDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
```

Replace the whole file with:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MOBILE_BOTTOM_NAV_HEIGHT, NavBar } from './components/NavBar'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { color, label } from './lib/tokens'
import { useIsMobile } from './lib/useIsMobile'
import { ContactDetail } from './screens/ContactDetail'
import { Import } from './screens/Import'
import { Network } from './screens/Network'
import { Profile } from './screens/Profile'
import { Pulse } from './screens/Pulse'
import { Welcome } from './screens/Welcome'

function AppRoutes() {
  const isMobile = useIsMobile()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (!user) return <Welcome />

  return (
    <>
      <NavBar />
      <div
        style={{
          paddingBottom: isMobile
            ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`
            : 0,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/network" replace />} />
          <Route path="/network" element={<Network />} />
          <Route path="/import" element={<Import />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/contact/:id" element={<ContactDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Configure Supabase Auth in the dashboard**

In the Supabase dashboard for this project:

1. Go to **Authentication → Providers** and confirm the **Email** provider is enabled (it is by default on a new project).
2. Go to **Authentication → URL Configuration**. Set **Site URL** to `http://localhost:5173` for now (you'll add the production URL in Step 7). Add `http://localhost:5173/**` to **Redirect URLs**.
3. Leave **"Allow new users to sign up"** (may be labeled "Enable email signups" depending on dashboard version, under Authentication → Providers → Email, or Authentication → Sign In / Up settings) turned **on** for now — you need it on to create your own account in Step 6.

- [ ] **Step 5: Manually verify the Welcome screen renders**

Run: `npm run dev`, open `http://localhost:5173`.

Expected: you see the `Welcome` screen (wordmark, pitch, email input) — not the app. None of the existing routes (`/network`, etc.) are reachable; visiting them directly still shows `Welcome` since the gate checks session, not path.

- [ ] **Step 6: Log in for real**

Enter your own email in the `Welcome` form and click "Send sign-in link". Expected: the button shows "Sending…" then the card switches to "Check `<your email>` for a sign-in link." Check your inbox, click the link.

Expected: the browser opens the app at `http://localhost:5173` and this time renders the full app (`NavBar` + `/network`) instead of `Welcome` — confirming `AuthProvider` picked up the new session. (Your existing seeded contacts won't show yet — every query still reads `DEFAULT_USER_ID`, unaffected by login. That's expected until Task 5.)

- [ ] **Step 7: Lock the door behind you**

Back in the Supabase dashboard, **Authentication → Providers → Email** (or wherever Step 4 found the toggle): turn **off** "Allow new users to sign up." Also add your deployed Vercel URL (visible in your Vercel project dashboard) to **Redirect URLs**, and update **Site URL** if you want production to be the primary one — both dev and prod URLs can coexist in the Redirect URLs list.

Expected: from this point on, `signInWithOtp` for any email other than yours fails server-side. You can re-verify your own login still works by signing out (once Task 3 ships) and requesting a fresh link.

- [ ] **Step 8: Commit**

```bash
git add src/screens/Welcome.tsx src/App.tsx
git commit -m "Add Welcome screen and gate the app behind a real login"
```

---

### Task 3: Add a sign-out control to `NavBar`

**Files:**
- Modify: `src/components/NavBar.tsx` (151 lines)

**Interfaces:**
- Consumes: `useAuth()` → `signOut()` (Task 1).

- [ ] **Step 1: Import `useAuth` and add a `SignOutButton` component**

At the top of `src/components/NavBar.tsx`, this block (lines 1-3):

```tsx
import { NavLink } from 'react-router-dom'
import { color, font, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
```

becomes:

```tsx
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { color, font, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'
```

Add a `SignOutButton` component next to the existing `Wordmark` component (after its closing brace, around line 71):

```tsx
function SignOutButton() {
  const { signOut } = useAuth()
  return (
    <button
      type="button"
      onClick={() => void signOut()}
      style={{
        ...label,
        background: 'none',
        border: 'none',
        color: color.dim,
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  )
}
```

- [ ] **Step 2: Show it in the mobile top bar**

The mobile top `<nav>` (lines 79-94) currently reads:

```tsx
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            height: 44,
            padding: '0 16px',
            background: 'rgba(9,10,9,.72)',
            backdropFilter: 'blur(22px) saturate(150%)',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <Wordmark dotSize={8} fontSize={12} />
        </nav>
```

Add `justifyContent: 'space-between'` and render `SignOutButton` alongside the wordmark:

```tsx
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 44,
            padding: '0 16px',
            background: 'rgba(9,10,9,.72)',
            backdropFilter: 'blur(22px) saturate(150%)',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <Wordmark dotSize={8} fontSize={12} />
          <SignOutButton />
        </nav>
```

- [ ] **Step 3: Show it in the desktop bar**

The desktop `<nav>` (previously lines 116-149) currently ends:

```tsx
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: 3,
          background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.014))',
          border: `1px solid ${color.border}`,
          borderRadius: 15,
        }}
      >
        <NavLinks mobile={false} />
      </div>
    </nav>
  )
}
```

Add a flex spacer and `SignOutButton` after that pill `<div>`, before `</nav>`:

```tsx
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: 3,
          background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.014))',
          border: `1px solid ${color.border}`,
          borderRadius: 15,
        }}
      >
        <NavLinks mobile={false} />
      </div>
      <div style={{ flex: 1 }} />
      <SignOutButton />
    </nav>
  )
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 5: Manually verify sign-out and sign-back-in**

Run: `npm run dev`, log in if not already. Click "Sign out" (top-right on mobile, far right on desktop).

Expected: the app immediately shows `Welcome` again (no page reload needed — `onAuthStateChange` fires and `AuthProvider`'s `user` becomes `null`). Request a fresh sign-in link for your email and confirm it logs you back in.

- [ ] **Step 6: Commit**

```bash
git add src/components/NavBar.tsx
git commit -m "Add sign-out control to NavBar"
```

---

### Task 4: Re-point existing data to your real account

**Files:** none — this task only runs SQL against the live Supabase database by hand, per this repo's established "no migration tooling" pattern.

**Interfaces:**
- Produces: every existing `contact` row (and the single `app_user` row) now has `user_id`/`id` equal to your real `auth.uid()` instead of the fixed `00000000-0000-0000-0000-000000000001`. Task 5's app-code switch and Task 6's RLS policies both assume this has already happened — if it hasn't, Task 5 will make your existing contacts appear to vanish (they're still owned by the old id).

This has to happen as an insert-then-repoint-then-delete, not a direct `update app_user set id = ...`, because `contact.user_id` has a foreign key to `app_user(id)` with no `ON UPDATE CASCADE` — directly changing the referenced row's `id` while rows still point at the old value violates the constraint.

- [ ] **Step 1: Find your real user id**

In the Supabase SQL editor, run:

```sql
select id, email from auth.users;
```

Expected: one row — your email, from Task 2's login. Copy its `id`.

- [ ] **Step 2: Re-point your data to that id**

In the Supabase SQL editor, run (substituting your real id for `<YOUR_AUTH_UID>` in all three statements):

```sql
begin;

insert into app_user (id, name, headline, looking_for)
select '<YOUR_AUTH_UID>', name, headline, looking_for
from app_user
where id = '00000000-0000-0000-0000-000000000001';

update contact
set user_id = '<YOUR_AUTH_UID>'
where user_id = '00000000-0000-0000-0000-000000000001';

delete from app_user where id = '00000000-0000-0000-0000-000000000001';

commit;
```

- [ ] **Step 3: Verify the re-point worked**

Run:

```sql
select id, name, headline from app_user;
select count(*) from contact where user_id = '<YOUR_AUTH_UID>';
```

Expected: one `app_user` row with your real id, and the `contact` count matches your known number of seeded contacts (24, per `db/seed.sql`, unless you've added/removed any).

No git commit for this task — it's a one-time change to the live database only, no repository files change.

---

### Task 5: Replace `DEFAULT_USER_ID` with the real session user id

**Files:**
- Modify: `src/lib/useContactsWithScore.ts` (53 lines)
- Modify: `src/screens/Network.tsx:113-114`
- Modify: `src/screens/Profile.tsx:1-61,100-109`
- Modify: `src/screens/Pulse.tsx:1-29,36`
- Modify: `src/screens/Import.tsx:1-9,169-221,258-263`
- Modify: `src/lib/supabase.ts:12-13`

**Interfaces:**
- Consumes: `useAuth()` → `user: User | null` (Task 1). Every call site in this task uses `user!.id` — the non-null assertion is safe because `App.tsx` (Task 2) never renders any of these components unless `user` is already non-null.
- Produces: `useContactsWithScore(userId: string): State` — the hook's signature changes from zero-argument to requiring the caller's user id. `Network.tsx` and `Profile.tsx` (its only two callers) are both updated in this task.

Do this task only after Task 4 — otherwise, the moment this ships, your own screens will show zero contacts (queries would filter on your real id, but the data wouldn't be re-pointed to it yet).

- [ ] **Step 1: Update `useContactsWithScore.ts` to take a `userId` parameter**

Full current file:

```ts
import { useEffect, useState } from 'react'
import { DEFAULT_USER_ID, supabase } from './supabase'
import type { Contact, ContactScore, ContactWithScore } from './types'

interface State {
  contacts: ContactWithScore[]
  loading: boolean
  error: string | null
}

export function useContactsWithScore(): State {
  const [state, setState] = useState<State>({ contacts: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [contactsRes, scoresRes] = await Promise.all([
        supabase.from('contact').select('*').eq('user_id', DEFAULT_USER_ID),
        supabase.from('contact_score').select('*').eq('user_id', DEFAULT_USER_ID),
      ])

      if (cancelled) return

      if (contactsRes.error) {
        setState({ contacts: [], loading: false, error: contactsRes.error.message })
        return
      }
      if (scoresRes.error) {
        setState({ contacts: [], loading: false, error: scoresRes.error.message })
        return
      }

      const scoresById = new Map<string, ContactScore>(
        (scoresRes.data as ContactScore[]).map((s) => [s.id, s]),
      )

      const merged: ContactWithScore[] = (contactsRes.data as Contact[])
        .map((c) => ({ ...c, score: scoresById.get(c.id) ?? null }))
        .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))

      setState({ contacts: merged, loading: false, error: null })
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
```

Replace it with:

```ts
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Contact, ContactScore, ContactWithScore } from './types'

interface State {
  contacts: ContactWithScore[]
  loading: boolean
  error: string | null
}

export function useContactsWithScore(userId: string): State {
  const [state, setState] = useState<State>({ contacts: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [contactsRes, scoresRes] = await Promise.all([
        supabase.from('contact').select('*').eq('user_id', userId),
        supabase.from('contact_score').select('*').eq('user_id', userId),
      ])

      if (cancelled) return

      if (contactsRes.error) {
        setState({ contacts: [], loading: false, error: contactsRes.error.message })
        return
      }
      if (scoresRes.error) {
        setState({ contacts: [], loading: false, error: scoresRes.error.message })
        return
      }

      const scoresById = new Map<string, ContactScore>(
        (scoresRes.data as ContactScore[]).map((s) => [s.id, s]),
      )

      const merged: ContactWithScore[] = (contactsRes.data as Contact[])
        .map((c) => ({ ...c, score: scoresById.get(c.id) ?? null }))
        .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))

      setState({ contacts: merged, loading: false, error: null })
    }

    load()

    return () => {
      cancelled = true
    }
  }, [userId])

  return state
}
```

- [ ] **Step 2: Update `Network.tsx`'s call site**

In `src/screens/Network.tsx`, the imports (lines 1-8) currently read:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NetworkMap } from '../components/NetworkMap'
import { initials } from '../lib/format'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
import { color, font, label, radius, stageColor, stageLabel, tierLabel } from '../lib/tokens'
import type { ContactWithScore, Stage } from '../lib/types'
```

Add the `useAuth` import:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NetworkMap } from '../components/NetworkMap'
import { useAuth } from '../lib/AuthContext'
import { initials } from '../lib/format'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
import { color, font, label, radius, stageColor, stageLabel, tierLabel } from '../lib/tokens'
import type { ContactWithScore, Stage } from '../lib/types'
```

Line 114 currently reads:

```tsx
  const { contacts, loading, error } = useContactsWithScore()
```

Replace with:

```tsx
  const { user } = useAuth()
  const { contacts, loading, error } = useContactsWithScore(user!.id)
```

- [ ] **Step 3: Update `Profile.tsx`'s call sites**

The imports (lines 1-7) currently read:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, StatCell } from '../components/Section'
import { initials } from '../lib/format'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
```

Replace with:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, StatCell } from '../components/Section'
import { useAuth } from '../lib/AuthContext'
import { initials } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useContactsWithScore } from '../lib/useContactsWithScore'
import { useIsMobile } from '../lib/useIsMobile'
```

Line 44 currently reads:

```tsx
  const { contacts, loading: contactsLoading } = useContactsWithScore()
```

Replace with:

```tsx
  const { user } = useAuth()
  const { contacts, loading: contactsLoading } = useContactsWithScore(user!.id)
```

Line 61 currently reads:

```tsx
      supabase.from('app_user').select('*').eq('id', DEFAULT_USER_ID).maybeSingle(),
```

Replace with:

```tsx
      supabase.from('app_user').select('*').eq('id', user!.id).maybeSingle(),
```

Line 109 currently reads:

```tsx
      .eq('id', DEFAULT_USER_ID)
```

Replace with:

```tsx
      .eq('id', user!.id)
```

- [ ] **Step 4: Update `Pulse.tsx`'s call sites**

Line 6 currently reads:

```tsx
import { supabase, DEFAULT_USER_ID } from '../lib/supabase'
```

Replace with:

```tsx
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
```

Inside `export function Pulse() {` (line 13), the state declarations (lines 14-20) currently read:

```tsx
export function Pulse() {
  const [openSignals, setOpenSignals] = useState<SignalWithContact[]>([])
  const [weekSignals, setWeekSignals] = useState<SignalWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isMobile = useIsMobile()
```

Add `useAuth()` right after the opening brace:

```tsx
export function Pulse() {
  const { user } = useAuth()
  const [openSignals, setOpenSignals] = useState<SignalWithContact[]>([])
  const [weekSignals, setWeekSignals] = useState<SignalWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isMobile = useIsMobile()
```

Lines 26-38 (the `load` function's queries) currently read:

```tsx
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
```

Replace both `DEFAULT_USER_ID` occurrences with `user!.id`:

```tsx
    const [openRes, weekRes] = await Promise.all([
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', user!.id)
        .is('handled_at', null)
        .in('kind', actionableKinds)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('signal')
        .select('id, contact_id, kind, detail, occurred_at, handled_at, created_at, contact!inner(id, name, company, stage, user_id)')
        .eq('contact.user_id', user!.id)
        .gte('occurred_at', weekAgo)
        .order('occurred_at', { ascending: false }),
    ])
```

- [ ] **Step 5: Update `Import.tsx`'s call sites**

Line 4 currently reads:

```tsx
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
```

Replace with:

```tsx
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
```

Inside `export function Import() {` (line 150), the state declarations (lines 151-167) currently read:

```tsx
export function Import() {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('single')
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMessage, setManualMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const isMobile = useIsMobile()
```

Add `useAuth()` right after the opening brace:

```tsx
export function Import() {
  const { user } = useAuth()
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('single')
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMessage, setManualMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const isMobile = useIsMobile()
```

Line 180, inside `handleManualAdd`, currently reads:

```tsx
    const payload = {
      user_id: DEFAULT_USER_ID,
```

Replace with:

```tsx
    const payload = {
      user_id: user!.id,
```

Line 221, inside `handleFile`, currently reads:

```tsx
        supabase
          .from('contact')
          .select('linkedin_url')
          .eq('user_id', DEFAULT_USER_ID)
```

Replace with:

```tsx
        supabase
          .from('contact')
          .select('linkedin_url')
          .eq('user_id', user!.id)
```

Line 263, inside `runImport`, currently reads:

```tsx
          {
            user_id: DEFAULT_USER_ID,
```

Replace with:

```tsx
          {
            user_id: user!.id,
```

- [ ] **Step 6: Remove `DEFAULT_USER_ID` from `supabase.ts`**

`src/lib/supabase.ts` currently ends with (lines 10-13):

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Single-user MVP: every row belongs to this fixed owner until auth ships.
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'
```

Replace with:

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 7: Verify it compiles**

Run: `npm run build`
Expected: succeeds with no TypeScript errors — this also confirms there are no remaining references to `DEFAULT_USER_ID` anywhere (a leftover import would fail the build).

- [ ] **Step 8: Manually verify in the browser**

Run: `npm run dev`, make sure you're logged in (Task 2/3). Open `/network`, `/pulse`, `/profile`, `/import`.

Expected: `/network` and `/profile` show your 24 re-pointed contacts (Task 4) sorted/scored correctly. `/pulse` shows the same open/week signals it did before this task (the underlying signals didn't move, only the id used to look them up via their contact changed). `/profile`'s name/headline/looking-for fields load and are editable. Adding a contact via `/import`'s "Add one" form succeeds and the new contact shows up on `/network`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/useContactsWithScore.ts src/lib/supabase.ts src/screens/Network.tsx src/screens/Profile.tsx src/screens/Pulse.tsx src/screens/Import.tsx
git commit -m "Replace DEFAULT_USER_ID with the real session user id"
```

---

### Task 6: Enable Row Level Security and lock down `contact_score`

**Files:**
- Modify: `db/schema.sql`

**Interfaces:**
- Consumes: nothing new in TypeScript — this task only changes the database and the schema-for-fresh-installs file.

Do this task last, after Task 5 ships and you've confirmed the app works logged in under your real id — turning on RLS while the app still queried by the old fixed id (or before your data was re-pointed) would make your own contacts appear to vanish, even though nothing would actually be broken at the database level.

- [ ] **Step 1: Apply RLS to the live database**

In the Supabase SQL editor, run:

```sql
alter table app_user enable row level security;
alter table contact enable row level security;
alter table signal enable row level security;
alter table note enable row level security;
alter table stage_event enable row level security;

create policy "app_user_own_row" on app_user
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "contact_own_rows" on contact
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "signal_via_contact" on signal
  for all
  using (exists (select 1 from contact c where c.id = signal.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = signal.contact_id and c.user_id = auth.uid()));

create policy "note_via_contact" on note
  for all
  using (exists (select 1 from contact c where c.id = note.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = note.contact_id and c.user_id = auth.uid()));

create policy "stage_event_via_contact" on stage_event
  for all
  using (exists (select 1 from contact c where c.id = stage_event.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = stage_event.contact_id and c.user_id = auth.uid()));

alter view contact_score set (security_invoker = true);
```

- [ ] **Step 2: Update `db/schema.sql` to match, for a fresh install**

The `app_user` table block (lines 6-13) currently reads:

```sql
create table app_user (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text,
  looking_for text
);

insert into app_user (id, name, headline)
values ('00000000-0000-0000-0000-000000000001', 'Me', 'B2B consultant');
```

Remove the seed insert — a fresh install now needs a real login (creating a real `auth.users` row) before any `app_user` row can exist, since RLS would reject an insert with no matching session anyway:

```sql
create table app_user (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text,
  looking_for text
);
```

The `contact` table's `user_id` column (line 20-21, inside the `create table contact (...)` block) currently reads:

```sql
  user_id       uuid not null references app_user(id)
                default '00000000-0000-0000-0000-000000000001',
```

Remove the now-stale default — every insert always sets `user_id` explicitly from the session (Task 5), and a row that ever hit this default would reference an `app_user` id that no longer exists post-migration anyway:

```sql
  user_id       uuid not null references app_user(id),
```

At the end of `db/schema.sql`, after the `contact_score` view definition, add:

```sql

-- Row Level Security: every table is locked to the owning Supabase Auth
-- user. contact_score must run with the querying user's own privileges
-- (not the view owner's, which is Postgres's default for views) or it
-- would silently bypass every policy below.
alter view contact_score set (security_invoker = true);

alter table app_user enable row level security;
alter table contact enable row level security;
alter table signal enable row level security;
alter table note enable row level security;
alter table stage_event enable row level security;

create policy "app_user_own_row" on app_user
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "contact_own_rows" on contact
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "signal_via_contact" on signal
  for all
  using (exists (select 1 from contact c where c.id = signal.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = signal.contact_id and c.user_id = auth.uid()));

create policy "note_via_contact" on note
  for all
  using (exists (select 1 from contact c where c.id = note.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = note.contact_id and c.user_id = auth.uid()));

create policy "stage_event_via_contact" on stage_event
  for all
  using (exists (select 1 from contact c where c.id = stage_event.contact_id and c.user_id = auth.uid()))
  with check (exists (select 1 from contact c where c.id = stage_event.contact_id and c.user_id = auth.uid()));
```

Also update the file's top-of-file comment (lines 1-3), which currently reads:

```sql
-- Northstar schema — single-user MVP, no auth.
-- user_id exists on every table but defaults to one fixed owner.
-- When auth is added later, swap the default for auth.uid() and enable RLS.
```

Replace with:

```sql
-- Northstar schema — single real user, authenticated via Supabase Auth
-- (magic link). Every table is locked to that user's auth.uid() via RLS —
-- see the policies at the end of this file. A fresh install needs someone
-- to log in (creating an auth.users row) before any app_user/contact row
-- can exist.
```

- [ ] **Step 3: Verify the app still works logged in**

Run: `npm run dev`, confirm you're still logged in. Open `/network`, `/pulse`, `/profile`.

Expected: identical to Task 5 Step 8 — your contacts, signals, and profile all still load. If any screen goes blank or errors, the most likely cause is one of the four `signal`/`note`/`stage_event` policies not matching a query pattern the app uses (e.g. an insert that doesn't set `contact_id` to a contact you own) — check the browser console for the Postgres error message, which will name the failing policy.

- [ ] **Step 4: Verify the database is actually locked down**

From a terminal (not the browser), run (substituting your project's actual `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local`):

```bash
curl "<VITE_SUPABASE_URL>/rest/v1/contact?select=*" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>"
```

Expected: `[]` — an empty array. This is the anon key with no user session attached, exactly what anyone who found `.env.local` in the repo would have; before this task, this same command would have returned every contact.

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql
git commit -m "Enable Row Level Security on every table, lock down contact_score"
```

---

### Task 7: Update `CLAUDE.md`'s non-negotiables

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the auth non-negotiable**

`CLAUDE.md`'s "Non-negotiables" section currently includes:

```markdown
- Single user, NO AUTH yet. Every table has user_id defaulting to
  '00000000-0000-0000-0000-000000000001'. Never remove that column.
```

Replace with:

```markdown
- Single user, real auth via Supabase Auth (magic link). Every table has
  user_id (or is scoped indirectly through contact_id) enforced by Row
  Level Security against auth.uid() — see db/schema.sql. Never remove
  that column, and never disable RLS.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md non-negotiables to reflect real auth"
```

---

## Self-Review

**Spec coverage:**
- Decision 1 (single real account) → enforced by Task 2 Step 7 (disable sign-ups) and never building a general sign-up flow anywhere in this plan. ✅
- Decision 2 (magic link) → Task 2's `Welcome.tsx` uses `signInWithOtp`, no password field. ✅
- Decision 3 (RLS policies) → Task 6 Step 1/2, exact policy SQL for all five tables. ✅
- Decision 4 (`security_invoker` on `contact_score`) → Task 6 Step 1/2. ✅
- Decision 5 (lockdown via dashboard, not app code) → Task 2 Step 7. ✅
- Decision 6 (`AuthContext`/`useAuth()`) → Task 1. ✅
- Decision 7 (`Welcome` screen gates all routes) → Task 2 Steps 1-2. ✅
- Decision 8 (`DEFAULT_USER_ID` removed) → Task 5. ✅
- Decision 9 (sign-out in `NavBar`) → Task 3. ✅
- Rollout order (RLS after re-pointing) → this plan sequences Task 4 (re-point) → Task 5 (code switch) → Task 6 (RLS) specifically so no intermediate step ever shows an unexpectedly empty screen; this is a tighter ordering than the spec's own rollout section, chosen because tracing through it revealed the code-switch is actually safe to ship earlier (nothing calls it until a session exists) — but re-pointing data before flipping RLS on is still the one hard requirement, and this order satisfies it. ✅
- CLAUDE.md update → Task 7. ✅
- `db/seed.sql` explicitly left alone → stated in Global Constraints, not touched by any task. ✅

**Placeholder scan:** no TBD/TODO; every step has literal code or literal SQL, not descriptions of code.

**Type consistency:** `useContactsWithScore(userId: string)` (Task 5 Step 1) matches both call sites — `useContactsWithScore(user!.id)` in `Network.tsx` (Step 2) and `Profile.tsx` (Step 3). `useAuth()`'s returned shape (`{ user, session, loading, signOut }`, Task 1) matches every consumer: `const { user, loading } = useAuth()` in `App.tsx` (Task 2), `const { signOut } = useAuth()` in `NavBar.tsx` (Task 3), `const { user } = useAuth()` in `Network.tsx`/`Profile.tsx`/`Pulse.tsx`/`Import.tsx` (Task 5).
