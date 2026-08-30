# Real Login Design

## Purpose

Northstar currently has no authentication: every table's `user_id` defaults
to a hardcoded UUID (`DEFAULT_USER_ID` in `src/lib/supabase.ts`), and
`db/schema.sql` has zero RLS policies. The deployed app is protected only by
the URL being unlisted — anyone with the Supabase URL + anon key (both
committed to `.env.local` on purpose, since the anon key is meant to be
public) can read and write the entire database directly, no login required.

This spec replaces that with real authentication: a single real account
(the consultant using the app), backed by a Supabase Auth session, with the
database actually locked down by Row Level Security. It adds a `/welcome`
gate with a short pitch and a magic-link sign-in, and removes the hardcoded
`DEFAULT_USER_ID` in favor of the logged-in session's user id.

This is **not** multi-tenant. One person logs in. No sign-up flow for
arbitrary emails, no per-user onboarding, no team/sharing features — all of
that stays out of scope per CLAUDE.md's "no teams, sharing, permissions"
rule. The only thing that changes is *who* that fixed user is: a hardcoded
UUID becomes a real authenticated identity.

## Non-negotiables (from CLAUDE.md)

- No CSS framework. Inline styles + `src/lib/tokens.ts`.
- No component library. No state manager beyond React state + a couple of hooks.
- TypeScript strict, no `any`.
- Dark UI, existing visual language unchanged.
- Priority scoring stays in the Postgres `contact_score` view — untouched by this work, but see the `security_invoker` note below, which is required for the view to keep working correctly *once RLS exists*, not a scoring-logic change.
- No teams, sharing, or permissions — this spec deliberately stays single-user.
- This line in CLAUDE.md gets updated as part of this work: *"Single user, NO AUTH yet. Every table has user_id defaulting to '00000000-0000-0000-0000-000000000001'. Never remove that column."* The "no auth yet" and hardcoded-default parts become stale; the "never remove the `user_id` column" part stays true (the column remains, it just no longer defaults to a fixed value once RLS is in place).

## Current state (baseline)

- `src/lib/supabase.ts` creates the Supabase client and exports `DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'`.
- `DEFAULT_USER_ID` is imported directly in `Pulse.tsx`, `Profile.tsx`, `Import.tsx`, and `src/lib/useContactsWithScore.ts` to scope every query/insert.
- `db/schema.sql`: `app_user` has one seeded row with `id = '00000000-0000-0000-0000-000000000001'`. `contact.user_id` defaults to and is always set to that same UUID. `signal`, `note`, and `stage_event` have no `user_id` column of their own — they're scoped indirectly via `contact_id → contact.user_id`.
- `db/schema.sql` has no RLS enabled anywhere, and no policies.
- `db/seed.sql` inserts demo contacts, all hardcoded to the same fixed `user_id`. It's meant to be re-run by hand in the Supabase SQL editor (no migration tooling exists in this repo).
- `App.tsx` renders `NavBar` + routes unconditionally — no auth check, no gate.
- No `Welcome` screen, no `AuthContext`, no session handling anywhere in the app today.

## Decisions

1. **Single real account, not multi-tenant.** One person, one login. No
   general sign-up flow — see decision 5 (lockdown).

2. **Magic link (email OTP) via Supabase Auth**, not password or OAuth. No
   password to set/remember/reset; fewer moving parts for a single account
   than wiring up a Google OAuth consent screen.

3. **RLS is the actual security boundary, not the login screen.** A
   `/welcome` gate alone would be cosmetic — the anon key still has direct
   database access regardless of what the React app shows. This spec
   enables RLS on every table and adds policies keyed on `auth.uid()`:
   - `app_user`: `using (id = auth.uid())`
   - `contact`: `using (user_id = auth.uid())`, `with check (user_id = auth.uid())`
   - `signal`, `note`, `stage_event`: no `user_id` column of their own, so their policies check ownership through the parent contact, e.g. for `signal`:
     ```sql
     using (exists (
       select 1 from contact c
       where c.id = signal.contact_id and c.user_id = auth.uid()
     ))
     ```
     same shape for `note` and `stage_event`.

4. **`contact_score` needs `security_invoker = true`.** Postgres views run
   with the *view owner's* privileges by default, not the querying user's —
   so without this, `contact_score` would silently bypass the new RLS
   policies on `contact`/`signal` and could return rows regardless of who's
   asking. This is a one-line fix (`alter view contact_score set
   (security_invoker = true);`) applied once RLS is live, and does not
   change any scoring logic, weights, or the view's SQL body.

5. **Lockdown via Supabase Auth settings, not app-level checks.** Supabase's
   magic-link sign-in auto-creates an `auth.users` row for any email by
   default, which would defeat the purpose of "single real account." The
   sequence: enable the Email/OTP provider, sign in once yourself (creating
   your `auth.users` row), then turn off "Allow new user sign-ups" in the
   Supabase dashboard. After that, magic-link requests for any other email
   fail server-side — enforced by Supabase, not bypassable by hitting the
   API directly the way an app-level email allowlist would be.

6. **`AuthContext` + `useAuth()` hook**, no new state-management library.
   A `src/lib/AuthContext.tsx` provider wraps `supabase.auth.getSession()`
   and `onAuthStateChange`, exposing `{ user, session, loading, signOut }`.
   Fits CLAUDE.md's "React state + a couple of hooks" allowance — same
   pattern as the existing `useIsMobile()` / `useContactsWithScore()` hooks.

7. **`Welcome` screen: pitch + magic-link box, gates all routes.**
   `src/screens/Welcome.tsx` shows the Northstar wordmark, the one-line pitch
   ("who should I contact this week, and why"), and an email input that
   calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo:
   window.location.origin } })`, then swaps to a "check your email" state.
   In `App.tsx`, if there's no session, `Welcome` renders regardless of
   path (no route-by-route guarding needed — single gate at the top). Once
   a session exists, the existing five routes render exactly as they do
   today.

8. **`DEFAULT_USER_ID` is removed entirely.** Every current import site
   (`Pulse.tsx`, `Profile.tsx`, `Import.tsx`, `useContactsWithScore.ts`)
   switches to `user.id` read from `useAuth()`. Same shape (a uuid string)
   flowing into the same query/insert calls — no query logic changes, only
   where the id comes from.

9. **Sign-out control lives in `NavBar`.** A small text link/button next to
   the existing nav items, calling `signOut()` from `useAuth()`.

## Data migration & rollout order

RLS must go live *after* your data is re-pointed to your real `auth.uid()`,
or your own existing contacts become invisible to you the moment RLS turns
on (they'd still belong to the old fixed UUID, which no longer matches any
`auth.uid()`). Order matters:

1. Ship the `Welcome` screen, `AuthContext`, and `App.tsx` gating — RLS
   **not yet enabled**, `DEFAULT_USER_ID` **not yet removed** from the DB
   side (app code already reads from session by this point, but the DB is
   still open).
2. Configure Supabase Auth (Email/OTP provider, Site URL + Redirect URLs
   covering both `http://localhost:5173` and the deployed Vercel URL).
3. Log in once via the new `Welcome` screen. This creates your real
   `auth.users` row and gives you your actual `auth.uid()`.
4. Turn off "Allow new user sign-ups" in the Supabase dashboard.
5. Run one-time SQL by hand in the Supabase SQL editor (same pattern this
   repo already uses for schema/seed changes — no migration tool exists):
   reassign the existing `app_user` row's `id` from the fixed UUID to your
   real `auth.uid()` (or insert a new `app_user` row with that id and drop
   the old one), then update every `contact.user_id` from the fixed UUID to
   the same value.
6. Only now enable RLS on all five tables and apply the policies from
   decision 3, plus the `security_invoker` fix from decision 4.
7. Remove `DEFAULT_USER_ID` from `src/lib/supabase.ts` and its four import
   sites (decision 8).
8. Update `db/schema.sql` to reflect the new reality for a fresh install:
   RLS enabled, policies included, no seeded `app_user` row with a
   hardcoded id (a fresh install now needs a real login before any data
   exists).
9. Update `CLAUDE.md`'s non-negotiables line per the note at the end of
   the "Non-negotiables" section above.

**Known side effect:** `db/seed.sql` hardcodes the old fixed UUID as
`user_id` on every insert. After this migration, re-running it as-is would
create contacts owned by a UUID that no longer maps to any real
`auth.uid()` — invisible under RLS. `db/seed.sql` is out of scope for this
spec to fix (it's demo/test tooling, not part of the login feature), but
whoever runs it next needs to know it's now stale and either update the
hardcoded UUID first or accept the rows will need manual re-pointing too.

## Testing

No test framework exists in this repo (confirmed: no vitest/jest, no `test`
script in `package.json`). As with prior work, verification is `npm run
build` (type-check) plus manual checks against the dev server and the real
Supabase project:

- Magic-link email arrives and its link logs you in (dev and, separately,
  the deployed URL).
- Visiting any route (`/network`, `/pulse`, etc.) without a session renders
  `Welcome`, not the underlying screen.
- After sign-out, the app returns to `Welcome`.
- After the data migration, your existing seeded contacts are visible and
  fully functional (Pulse, Network, ContactDetail, Import all still work)
  under your real account.
- With RLS enabled, a request made with the anon key but no valid session
  (e.g. via `curl` with just the anon key, no auth header) returns no rows
  from `contact` — confirming the database is actually locked down, not
  just the UI.

## Self-review

- **Placeholder scan:** no TBD/TODO; every decision has a concrete
  mechanism (specific Supabase settings, specific SQL shapes, specific
  file/hook names).
- **Internal consistency:** the rollout order (RLS last, after data
  re-pointing) matches decision 3's RLS policies and decision 4's
  `security_invoker` fix — nothing enables RLS before the data that would
  need to satisfy it is in place.
- **Scope check:** single feature (auth + RLS lockdown), one implementation
  plan's worth of work — not decomposed further.
- **Ambiguity check:** "just me, one real account" (not multi-tenant) is
  stated in decision 1 and reinforced by decision 5's lockdown mechanism,
  so there's no path in this spec that accidentally builds general
  multi-user sign-up.
