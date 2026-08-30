# Mobile Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Northstar's existing screens (Network, Import, Pulse, ContactDetail, Profile) usable in a phone-width browser, without changing desktop behavior.

**Architecture:** A single `useIsMobile()` hook (`matchMedia('(max-width: 680px)')`) is the one responsive primitive. Every screen and the nav bar call it and branch their existing inline `style={{ ... }}` objects on the boolean it returns — no CSS media queries, no new styling mechanism.

**Tech Stack:** React 19, TypeScript (strict), Vite, react-router-dom 7. No test framework in this repo — verification is `tsc -b` (via `npm run build`), `oxlint` (via `npm run lint`), and manual browser checks.

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-responsive-design.md`

## Global Constraints

- Single user, no auth — `user_id` columns untouched (this plan touches no data model or Supabase code).
- No CSS framework. Inline styles or `src/lib/tokens.ts` only — no new `.css` files, no `@media` blocks.
- No component library, no state manager beyond React state + hooks.
- TypeScript strict. No `any`.
- Responsive mechanism is `useIsMobile()` (`matchMedia`), breakpoint **680px**, defined once in `src/lib/useIsMobile.ts` — every screen consumes this same hook, never a second breakpoint value.
- Visual tokens (`color`, `font`, `radius`, `label`, `surfaceGradient`, `cardShadow` in `src/lib/tokens.ts`) are unchanged — mobile layouts reuse them, don't redefine them.
- No test framework is introduced. Every task's verification is: `npm run build` (typecheck) passes, `npm run lint` passes, and a manual check in the browser at 375×812 (mobile) and 1440×900 (desktop).
- Desktop layout must remain pixel-identical to its current appearance after every task — mobile branches are additive, not replacements of desktop styling.
- `contact_score` and all scoring logic are out of scope — untouched by this plan.

---

### Task 1: `useIsMobile()` hook + mobile navigation

**Files:**
- Create: `src/lib/useIsMobile.ts`
- Modify: `src/components/NavBar.tsx` (full rewrite)
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts` — imported by every later task.
- Produces: `MOBILE_BOTTOM_NAV_HEIGHT: number` exported from `src/components/NavBar.tsx`, consumed by `App.tsx`.

- [ ] **Step 1: Create the `useIsMobile` hook**

Create `src/lib/useIsMobile.ts`:

```ts
import { useEffect, useState } from 'react'

const QUERY = '(max-width: 680px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
```

- [ ] **Step 2: Rewrite `NavBar.tsx` with a mobile bottom tab bar**

Replace the full contents of `src/components/NavBar.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import { color, font, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'

const links = [
  { to: '/network', text: 'Network' },
  { to: '/import', text: 'Import' },
  { to: '/pulse', text: 'Pulse' },
  { to: '/profile', text: 'Profile' },
]

export const MOBILE_BOTTOM_NAV_HEIGHT = 60

function NavLinks({ mobile }: { mobile: boolean }) {
  return (
    <>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
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
        >
          {link.text}
        </NavLink>
      ))}
    </>
  )
}

function Wordmark({ dotSize, fontSize }: { dotSize: number; fontSize: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: color.accent,
          boxShadow: '0 0 14px 2px rgba(79,227,155,.55)',
        }}
      />
      <span
        style={{
          fontFamily: font.mono,
          fontSize,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: color.text,
        }}
      >
        Northstar
      </span>
    </div>
  )
}

export function NavBar() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <>
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
        <nav
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            display: 'flex',
            gap: 3,
            padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
            background: 'rgba(9,10,9,.92)',
            backdropFilter: 'blur(22px) saturate(150%)',
            borderTop: `1px solid ${color.border}`,
          }}
        >
          <NavLinks mobile />
        </nav>
      </>
    )
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 64,
        padding: '0 32px',
        background: 'rgba(9,10,9,.72)',
        backdropFilter: 'blur(22px) saturate(150%)',
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <div style={{ marginRight: 8 }}>
        <Wordmark dotSize={9} fontSize={13} />
      </div>
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

- [ ] **Step 3: Give routed content room for the fixed bottom bar**

Replace the full contents of `src/App.tsx`:

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

- [ ] **Step 4: Typecheck and lint**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

Run: `npm run lint`
Expected: exits 0, no oxlint errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the printed local URL in a browser.

At **1440×900** (desktop): confirm the top nav bar looks exactly as before — logo + wordmark, then the 4 links in a pill group, all in one sticky top row. No bottom bar visible.

At **375×812** (mobile — use the browser's device toolbar or resize the window): confirm the top bar shrinks to just the logo + wordmark (no links), a new bar is fixed to the bottom of the viewport with all 4 links spread edge to edge, tapping each link navigates to its route and highlights it accent-green, and the page content doesn't render underneath the bottom bar (scroll to the bottom of `/network` and confirm the last card isn't obscured).

- [ ] **Step 6: Commit**

```bash
git add src/lib/useIsMobile.ts src/components/NavBar.tsx src/App.tsx
git commit -m "feat: add mobile bottom tab bar and useIsMobile hook"
```

---

### Task 2: Network screen mobile layout

**Files:**
- Modify: `src/screens/Network.tsx`

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts`.

- [ ] **Step 1: Add the mobile branch to `Network.tsx`**

In `src/screens/Network.tsx`, add the import and hook call, then update the header row, the search input, and hide the Map view on mobile.

Add to the top imports:

```tsx
import { useIsMobile } from '../lib/useIsMobile'
```

Inside `export function Network()`, right after the existing `useState` declarations, add:

```tsx
  const isMobile = useIsMobile()
```

Replace the `return (...)` block with:

```tsx
  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FilterChip
            active={stageFilter === 'all'}
            onClick={() => setStageFilter('all')}
            text="All"
            count={counts.all}
          />
          {stages.map((s) => (
            <FilterChip
              key={s}
              active={stageFilter === s}
              onClick={() => setStageFilter(s)}
              text={stageLabel[s]}
              count={counts[s]}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or company"
            style={{
              background: color.surface,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              padding: '10px 14px',
              color: color.text,
              fontFamily: font.body,
              fontSize: 13,
              minWidth: isMobile ? undefined : 220,
              width: isMobile ? '100%' : undefined,
              outline: 'none',
            }}
          />
          {!isMobile && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>

      {loading && <div style={{ ...label, color: color.muted }}>Loading…</div>}
      {error && (
        <div style={{ ...label, color: color.lime }}>
          Could not load contacts: {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ ...label, color: color.muted }}>No contacts match.</div>
      )}

      {isMobile || view === 'cards' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(292px, 1fr))',
            gap: 22,
          }}
        >
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      ) : (
        <NetworkMap contacts={filtered} />
      )}
    </div>
  )
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`.

At **1440×900**: `/network` looks unchanged — filter chips and search+toggle in one row, Map view still reachable via the toggle and still renders the radial map.

At **375×812**: filter chips row sits above a full-width search input (stacked, not side by side); the Cards/Map toggle is gone entirely; contacts always render as cards (single column, since `minmax(292px,1fr)` only fits one column at this width); no horizontal scrolling on the page.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Network.tsx
git commit -m "feat: stack Network header and hide map view on mobile"
```

---

### Task 3: `SignalRow` shared component + Pulse screen mobile layout

**Files:**
- Create: `src/components/SignalRow.tsx`
- Modify: `src/screens/Pulse.tsx`

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts`.
- Produces: `SignalRow({ date: string, kind: string, detail?: string | null, contact?: { id: string, name: string } })` from `src/components/SignalRow.tsx` — consumed by this task's `Pulse.tsx` change and by Task 4's `ContactDetail.tsx` change.

- [ ] **Step 1: Create `SignalRow`**

Create `src/components/SignalRow.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { color, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'

interface SignalRowProps {
  date: string
  kind: string
  detail?: string | null
  contact?: { id: string; name: string }
}

export function SignalRow({ date, kind, detail, contact }: SignalRowProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {contact ? (
            <Link to={`/contact/${contact.id}`} style={{ ...label, color: color.text, textDecoration: 'none' }}>
              {contact.name}
            </Link>
          ) : (
            <span style={{ ...label, color: color.dim }}>{date}</span>
          )}
          <span style={{ ...label, color: color.accent, flexShrink: 0 }}>{kind}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {contact && <span style={{ ...label, color: color.dim, flexShrink: 0 }}>{date}</span>}
          {detail && <span style={{ fontSize: 13, color: color.muted }}>{detail}</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ ...label, color: color.dim, width: 90, flexShrink: 0 }}>{date}</span>
      {contact && (
        <Link
          to={`/contact/${contact.id}`}
          style={{ ...label, color: color.text, width: 160, flexShrink: 0, textDecoration: 'none' }}
        >
          {contact.name}
        </Link>
      )}
      <span style={{ ...label, color: color.accent, width: contact ? 100 : 90, flexShrink: 0 }}>{kind}</span>
      {detail && <span style={{ fontSize: 13, color: color.muted }}>{detail}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Wire `SignalRow` and the mobile grid into `Pulse.tsx`**

In `src/screens/Pulse.tsx`, add the imports:

```tsx
import { SignalRow } from '../components/SignalRow'
import { useIsMobile } from '../lib/useIsMobile'
```

Inside `export function Pulse()`, right after the existing `useState` declarations, add:

```tsx
  const isMobile = useIsMobile()
```

This must come before the early `loading` and `error` returns, since hooks can't be called after a conditional return.

Update the three padding-32 divs (loading return, error return, and the main return) to `padding: isMobile ? 16 : 32`, and the grid's `gridTemplateColumns`:

```tsx
  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.lime }}>Could not load signals: {error}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {actionError && (
        <span style={{ ...label, color: color.lime }}>{actionError}</span>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {actionableKinds.map((kind) => (
          <PulseColumn key={kind} kind={kind} signals={columns[kind]} onDone={markHandled} />
        ))}
      </div>
      <WeekTable signals={weekSignals} />
    </div>
  )
```

Replace the `WeekTable` row-rendering block:

```tsx
function WeekTable({ signals }: { signals: SignalWithContact[] }) {
  return (
    <Section title="This week">
      {signals.length === 0 ? (
        <span style={{ fontSize: 13, color: color.dim }}>No signals in the last 7 days.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signals.map((s) => (
            <SignalRow
              key={s.id}
              date={new Date(s.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              kind={kindLabel[s.kind]}
              detail={s.detail}
              contact={{ id: s.contact.id, name: s.contact.name }}
            />
          ))}
        </div>
      )}
    </Section>
  )
}
```

Remove the now-unused `Link` import if `Link` is no longer referenced elsewhere in the file — check first: `SignalCard` still uses `Link`, so the `Link` import from `react-router-dom` stays.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`.

At **1440×900**: `/pulse` looks unchanged — 3 signal columns side by side, and the "This week" table rows show date/name/kind/detail in one horizontal line each, pixel-identical to before.

At **375×812**: the 3 signal columns stack into a single column (Job Change, then Funding, then Post Intent, each full width); "This week" rows become two-line cards — contact name and kind on the first line, date and detail on the second — with no horizontal overflow. Tapping a contact name still navigates to `/contact/:id`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SignalRow.tsx src/screens/Pulse.tsx
git commit -m "feat: extract SignalRow and stack Pulse layout on mobile"
```

---

### Task 4: ContactDetail screen mobile layout

**Files:**
- Modify: `src/screens/ContactDetail.tsx`

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts`; `SignalRow` from `src/components/SignalRow.tsx` (Task 3).

- [ ] **Step 1: Add the mobile branch to `ContactDetail.tsx`**

Add to the top imports:

```tsx
import { SignalRow } from '../components/SignalRow'
import { useIsMobile } from '../lib/useIsMobile'
```

Inside `export function ContactDetail()`, right after the existing `useState` declarations, add:

```tsx
  const isMobile = useIsMobile()
```

This must come before the `loading` and `notFound` early returns.

Update those two early-return divs' padding:

```tsx
  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }

  if (notFound || !contact) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ ...label, color: color.lime }}>Contact not found.</span>
        <Link to="/network" style={{ ...label, color: color.accent }}>
          ← Back to network
        </Link>
      </div>
    )
  }
```

Update the root container and the `<aside>`:

```tsx
  return (
    <div
      style={{
        padding: isMobile ? 16 : 32,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 20,
        alignItems: 'flex-start',
      }}
    >
      <aside
        style={{
          position: isMobile ? 'static' : 'sticky',
          top: isMobile ? undefined : 84,
          width: isMobile ? '100%' : 344,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: surfaceGradient,
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: cardShadow,
          overflow: 'hidden',
        }}
      >
```

(The rest of the `<aside>` contents — back link, avatar, name, tier bar, stat cells, email/LinkedIn buttons — are unchanged.)

Update the relationship-pipeline button styling (inside the `pipeline.map` callback) to shrink on mobile:

```tsx
                <button
                  key={step}
                  type="button"
                  onClick={() => moveStage(step)}
                  className="ns-stage-btn"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: isMobile ? '8px 6px' : '11px 10px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: isCurrent ? 'rgba(79,227,155,.09)' : color.surface,
                    border: `1px solid ${isCurrent ? color.accent : color.border}`,
                  }}
                >
```

And its stage-label span:

```tsx
                  <span
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      lineHeight: 1.25,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? color.text : isPast ? color.muted : color.dim,
                    }}
                  >
                    {stageLabel[step]}
                  </span>
```

Replace the "Signal history" section's row rendering:

```tsx
        <Section title="Signal history">
          {signals.length === 0 ? (
            <span style={{ fontSize: 13, color: color.dim }}>No signals recorded yet.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signals.map((s) => (
                <SignalRow key={s.id} date={formatSignalDate(s.occurred_at)} kind={s.kind} detail={s.detail} />
              ))}
            </div>
          )}
        </Section>
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open any `/contact/:id` page for a contact that has at least one signal.

At **1440×900**: layout is unchanged — sticky 344px sidebar to the left, sticky as you scroll, main content to the right; signal-history rows show date/kind/detail on one line each, pixel-identical to before.

At **375×812**: the sidebar renders first, full width, not sticky (scrolls away normally); the relationship-journey pipeline still shows all 4 stages side by side, text fits without wrapping or overflow; signal-history rows become two-line cards (date/kind on top, detail below); no horizontal overflow anywhere on the page.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ContactDetail.tsx
git commit -m "feat: stack ContactDetail sidebar and use SignalRow on mobile"
```

---

### Task 5: Profile screen mobile layout

**Files:**
- Modify: `src/screens/Profile.tsx`

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts`.

- [ ] **Step 1: Add the mobile branch to `Profile.tsx`**

Add to the top imports:

```tsx
import { useIsMobile } from '../lib/useIsMobile'
```

Inside `export function Profile()`, right after the existing `useState` declarations, add:

```tsx
  const isMobile = useIsMobile()
```

This must come before the `loading || contactsLoading` early return.

Update that early return's padding:

```tsx
  if (loading || contactsLoading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32 }}>
        <span style={{ ...label, color: color.muted }}>Loading…</span>
      </div>
    )
  }
```

Update the root grid container and the `<aside>`:

```tsx
  return (
    <div
      style={{
        padding: isMobile ? 16 : 32,
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '344px minmax(0,1fr)',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <aside
        style={{
          position: isMobile ? 'static' : 'sticky',
          top: isMobile ? undefined : 84,
          display: 'flex',
          flexDirection: 'column',
          background: surfaceGradient,
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: cardShadow,
          overflow: 'hidden',
        }}
      >
```

(The rest of the `<aside>` contents and the right-hand column are unchanged — both existing grids inside it already use `auto-fit, minmax(...)` and reflow to one column at 375px.)

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/profile`.

At **1440×900**: layout is unchanged — sticky 344px sidebar to the left, two-column stat grid and "Your week" grid to the right.

At **375×812**: the sidebar renders first, full width, not sticky; the "Your network by priority" / "By relationship state" section pair stacks to one column; the "Your week" 4-stat grid stacks to one column; the edit-profile form (name/headline/looking-for) is usable at full width; no horizontal overflow.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Profile.tsx
git commit -m "feat: stack Profile sidebar on mobile"
```

---

### Task 6: Import screen mobile padding

**Files:**
- Modify: `src/screens/Import.tsx`

**Interfaces:**
- Consumes: `useIsMobile(): boolean` from `src/lib/useIsMobile.ts`.

- [ ] **Step 1: Add the mobile branch to `Import.tsx`**

Add to the top imports:

```tsx
import { useIsMobile } from '../lib/useIsMobile'
```

Inside `export function Import()`, right after the existing `useState` declarations, add:

```tsx
  const isMobile = useIsMobile()
```

Update the root container's padding:

```tsx
    <div style={{ padding: isMobile ? 16 : 32, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
```

No other changes — the CSV preview table already scrolls horizontally (`overflowX: 'auto'` wrapper at the existing table), and both `Quick add` / `Map columns` grids already reflow via `auto-fill, minmax(220px, 1fr)`.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/import`.

At **1440×900**: layout is unchanged.

At **375×812**: the mode toggle, quick-add form, and (after loading a CSV) the column-mapping grid all fit within the viewport width with 16px side padding; the CSV preview table scrolls horizontally within its own bordered container without the page itself scrolling horizontally.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Import.tsx
git commit -m "feat: reduce Import screen padding on mobile"
```
