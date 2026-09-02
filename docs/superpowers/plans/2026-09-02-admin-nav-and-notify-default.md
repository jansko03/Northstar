# Admin Nav Styling & Notification Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/admin` nav entry visually read as a temporary/internal screen (not a finished feature) so stakeholders don't mistake it for a real one, and change the notification-preference default from "nothing selected" to "Comment selected."

**Architecture:** Two independent, single-file-ish changes. `NavBar.tsx`'s `links` array gains an optional `temp` flag consumed by the existing `NavLinks` style function (no new component). `db/schema.sql`'s `notify_kinds` default changes from `array[]::text[]` to `array['comment']`, applied both to the `create table` block (fresh installs) and as a guarded `update` against the live database (already-migrated single row).

**Tech Stack:** React 19, TypeScript (strict), Vite, react-router-dom 7, Supabase. No test framework in this repo — verification is `npm run build`, `npm run lint`, and manual browser checks.

**Spec:** No separate spec doc — this plan is the spec. Requirements come from user clarification in-chat:
1. Notifications should default to `['comment']`, not empty — Job Change/Funding/Post Intent stay available as toggle options exactly as they already are (they were never missing; this was a misreading of the existing screen).
2. The Admin nav link needs both a text cue ("temp") and a visually distinct style (muted, not the normal active-glow treatment) so it doesn't look like a finished nav item.
3. Out of scope for this plan (noted for later, not built now): letting Admin target notifications at specific *contacts*, not just signal kinds — that's a bigger feature (contact picker, new data shape) flagged by the user as a future idea only.

## Global Constraints

- No CSS framework. Inline styles or `src/lib/tokens.ts` only.
- No component library, no state manager beyond React state + hooks.
- TypeScript strict. No `any`.
- No test framework introduced. Verification is `npm run build` + `npm run lint` + manual browser check.
- `db/schema.sql` is hand-run against Supabase (no migration tooling) — any change to already-applied SQL needs a corresponding statement the user (or the agent, if it has DB access this session) runs against the live DB, not just an update to the file.
- Single user, no auth — `id`/`user_id` columns untouched by this plan.

---

### Task 1: Default `notify_kinds` to `['comment']`

**Files:**
- Modify: `db/schema.sql`

**Interfaces:**
- Consumes: nothing new — `Admin.tsx`'s `load()` already reads `notify_kinds` straight from the DB row with no hardcoded default (`(userRes.data.notify_kinds ?? []) as SignalKind[]`), so it needs no code change: whatever the DB returns is what renders as checked.

- [ ] **Step 1: Update the `create table app_user` default (fresh installs)**

In `db/schema.sql`, find:

```sql
  notify_kinds text[] not null default array[]::text[]
    check (notify_kinds <@ array['reaction','comment','job_change','funding','post_intent'])
```

Replace with:

```sql
  notify_kinds text[] not null default array['comment']
    check (notify_kinds <@ array['reaction','comment','job_change','funding','post_intent'])
```

- [ ] **Step 2: Update the commented-out live-DB migration block to match**

In the same file, find the commented migration block:

```sql
-- alter table app_user
--   add column notify_kinds text[] not null default array[]::text[],
--   add constraint app_user_notify_kinds_check
--     check (notify_kinds <@ array['reaction','comment','job_change','funding','post_intent']);
```

Replace with:

```sql
-- alter table app_user
--   add column notify_kinds text[] not null default array['comment'],
--   add constraint app_user_notify_kinds_check
--     check (notify_kinds <@ array['reaction','comment','job_change','funding','post_intent']);
```

(This block is documentation for anyone else setting up the schema fresh against a database that doesn't yet have the column — it was already run once against this project's live DB in a prior session, so Step 3 handles that database specifically.)

- [ ] **Step 3: Apply the default retroactively to the already-migrated live database**

The live Supabase database already has `notify_kinds` (added in a prior session) with its old default of `{}`, and the current row already has `{}` stored (not "unset" — Postgres defaults only apply to *new* rows, so changing the column default here does not touch the existing row). Run this against the live DB via the Supabase SQL editor:

```sql
update app_user
set notify_kinds = array['comment']
where notify_kinds = '{}';
```

The `where notify_kinds = '{}'` guard makes this safe to run more than once and avoids clobbering a real preference if the single user has already customized it away from empty by the time this runs.

If you (the agent) have browser access to the project's Supabase SQL editor this session (as in a prior session for this project), run it directly and verify with:

```sql
select notify_kinds from app_user;
```

Expected: `{comment}`. If you do not have that access, tell the user to run both statements themselves and report back.

- [ ] **Step 4: Verify**

Run: `npm run build` — expected exit 0 (this task only touches a `.sql` file, so this just confirms nothing else broke).

Manually (after Step 3 is applied): run `npm run dev`, visit `/admin`, confirm the "Comment" chip under Notifications is active by default and Job Change/Funding/Post Intent remain present as togglable (not pre-selected) options, matching how they already worked before this task.

- [ ] **Step 5: Commit**

```bash
git add db/schema.sql
git commit -m "feat: default notification preference to Comment"
```

---

### Task 2: Style the Admin nav link as temporary

**Files:**
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Produces: no new exports. `links` array entries gain an optional `temp?: boolean` field consumed only within this file's `NavLinks` component.

- [ ] **Step 1: Add the `temp` flag and updated label to the `links` array**

In `src/components/NavBar.tsx`, replace:

```tsx
const links = [
  { to: '/network', text: 'Network' },
  { to: '/import', text: 'Import' },
  { to: '/pulse', text: 'Pulse' },
  { to: '/profile', text: 'Profile' },
  { to: '/admin', text: 'Admin' },
]
```

with:

```tsx
const links = [
  { to: '/network', text: 'Network' },
  { to: '/import', text: 'Import' },
  { to: '/pulse', text: 'Pulse' },
  { to: '/profile', text: 'Profile' },
  { to: '/admin', text: 'Admin (temp)', temp: true },
]
```

- [ ] **Step 2: Give `temp` links a visually distinct style in `NavLinks`**

Replace the `NavLink` `style` callback inside `NavLinks` (currently):

```tsx
          style={({ isActive }) => ({
            ...label,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: mobile ? 1 : undefined,
            padding: mobile ? '10px 6px' : '7px 14px',
            borderRadius: mobile ? 10 : 11,
            color: isActive ? color.accent : color.muted,
            background: isActive
              ? 'linear-gradient(180deg, rgba(79,227,155,.19), rgba(79,227,155,.07))'
              : 'transparent',
            boxShadow: isActive
              ? '0 1px 0 rgba(255,255,255,.07) inset, 0 6px 18px -12px rgba(79,227,155,.7)'
              : 'none',
            textDecoration: 'none',
          })}
```

with:

```tsx
          style={({ isActive }) => ({
            ...label,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: mobile ? 1 : undefined,
            padding: mobile ? '10px 6px' : '7px 14px',
            borderRadius: mobile ? 10 : 11,
            border: link.temp ? `1px dashed ${color.border}` : 'none',
            color: link.temp ? color.dim : isActive ? color.accent : color.muted,
            background:
              !link.temp && isActive
                ? 'linear-gradient(180deg, rgba(79,227,155,.19), rgba(79,227,155,.07))'
                : 'transparent',
            boxShadow:
              !link.temp && isActive
                ? '0 1px 0 rgba(255,255,255,.07) inset, 0 6px 18px -12px rgba(79,227,155,.7)'
                : 'none',
            textDecoration: 'none',
          })}
```

This keeps the Admin link's dashed border and dim text even while active on `/admin` — it never gets the green glow/gradient the real nav items get when selected, so it reads as "not one of the finished screens" in both its resting and active states.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run build` — expected exit 0, no TypeScript errors (in particular, confirm the inferred type of `links` array elements allows the optional `temp` field with no explicit type annotation needed — object-literal-array inference already handles this).

Run: `npm run lint` — expected exit 0, no new warnings.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.

At **1440×900** (desktop): confirm the "ADMIN (TEMP)" pill in the top nav has a dashed border and dim/muted text at rest, and — unlike Network/Import/Pulse/Profile — does **not** get the green gradient background or glow when you're on `/admin` (still dim text, still dashed border, just the standard `NavLink` active state minus the accent treatment).

At **375×812** (mobile): confirm "ADMIN (TEMP)" still fits in its bottom-tab slot without wrapping awkwardly or overflowing into neighboring tabs; same dashed/dim treatment applies.

- [ ] **Step 5: Commit**

```bash
git add src/components/NavBar.tsx
git commit -m "feat: style Admin nav link as temporary"
```
