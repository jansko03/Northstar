# Mobile Responsive Design

## Purpose

Northstar is currently desktop-only: no `@media` queries exist anywhere, and
several layouts (fixed sidebars, a 3-column grid, a large radial map) break
or become unusable below ~680px wide. This spec makes the existing React/Vite
web app usable in a phone browser, so the solo consultant using it can check
"who to contact this week" without a laptop.

This is **not** a PWA and **not** a native app. Same routes, same Supabase
client, same screens — layouts adapt to viewport width.

## Non-negotiables (from CLAUDE.md)

- No CSS framework. Inline styles or one small tokens file.
- No component library. No state manager beyond React state + a couple of hooks.
- TypeScript strict, no `any`.
- Dark UI, existing visual language (`src/lib/tokens.ts`) unchanged.
- Priority scoring stays in the Postgres `contact_score` view — untouched by this work.

## Current state (baseline)

Screens: `/network`, `/import`, `/pulse`, `/contact/:id`, `/profile`, all
rendered under a single sticky top `NavBar`. No test framework is present in
the repo (`package.json` has no vitest/jest) — only `tsc -b` (build/typecheck)
and `oxlint`.

Layouts that will break under 680px width, found by reading each screen:

- `NavBar.tsx` — fixed horizontal row (logo + 4 nav pills), no wrap behavior.
- `Pulse.tsx` — signal columns use `gridTemplateColumns: 'repeat(3, 1fr)'`,
  rigid 3-across.
- `Pulse.tsx` `WeekTable` — rows are a horizontal flex of fixed-width columns
  (date 90px, name 160px, kind 100px, then detail text) that will overflow.
- `ContactDetail.tsx` — sticky 344px-wide `<aside>` + flex-1 main content in
  a single row; sidebar has no stacking behavior. Signal-history rows use the
  same fixed-width-column pattern as `WeekTable`.
- `Profile.tsx` — identical 344px sidebar + `minmax(0,1fr)` grid pattern as
  ContactDetail.
- `NetworkMap.tsx` — radial layout with fixed pixel radii (tier rings up to
  346px from center, ~700px total diameter, `MAP_HEIGHT = 780`). Not
  reflowable to a phone width without a full rebuild.
- `Import.tsx` — CSV preview `<table>` is `width: 100%` with no scroll
  wrapper; will squeeze/break on narrow screens. The two column-mapping grids
  already use `auto-fill, minmax(220px, 1fr)` and reflow fine.

Layouts that already reflow correctly and need no change:
- `Network.tsx` card grid (`auto-fill, minmax(292px, 1fr)`).
- `Profile.tsx`'s two `auto-fit` stat grids (`minmax(290px,1fr)`,
  `minmax(150px,1fr)`).
- "Waiting on you" cards in `Profile.tsx`.

## Decisions

1. **Responsive mechanism: `useIsMobile()` hook**, not CSS `@media` classes.
   A hook wrapping `window.matchMedia('(max-width: 680px)')`, returning a
   live boolean that updates on resize. Screens branch their existing inline
   style objects on it (e.g. `flexDirection: isMobile ? 'column' : 'row'`).
   This stays inside the established "inline styles + tokens file" pattern
   instead of introducing a second styling mechanism, and fits CLAUDE.md's
   "React state + a couple of hooks" allowance.

2. **Single breakpoint at 680px.** No tablet-specific breakpoint — single
   user, phone or desktop, no stated tablet use case (YAGNI).

3. **Navigation: bottom tab bar on mobile.** `NavBar.tsx` renders two modes:
   - **Mobile:** top bar shrinks to logo dot + wordmark only. The four links
     (Network, Import, Pulse, Profile) move to a new fixed bottom tab bar,
     `position: fixed; bottom: 0`, with
     `paddingBottom: 'env(safe-area-inset-bottom)'` for the iPhone home
     indicator. Every screen's root container gets extra `paddingBottom` on
     mobile so content isn't hidden behind the fixed bar.
   - **Desktop:** unchanged sticky top bar.

4. **Screen priority: Network / Pulse / ContactDetail / Profile get full
   mobile layouts. Import gets minimal "don't break" fixes only** — no
   touch-optimized redesign of the column-mapping flow.

5. **NetworkMap is hidden on mobile.** The "Map" view toggle in
   `Network.tsx` only renders when `!isMobile`; mobile always shows the Cards
   view. Rebuilding the radial map to scale to phone width is out of scope —
   it's a visualization nicety, not needed for the "who do I contact" task,
   and would require reworking `TIER_RADIUS`/`MAP_HEIGHT` geometry, a
   separate effort.

6. **ContactDetail's relationship pipeline stays 4-across on mobile**, not
   stacked vertically — collapsing it to a list loses the "journey"
   visualization that's the point of the component. Padding and font sizes
   shrink slightly at the mobile breakpoint to fit.

7. **Shared `SignalRow` component.** `ContactDetail.tsx`'s signal-history
   rows and `Pulse.tsx`'s `WeekTable` rows use near-identical markup (fixed
   date/name/kind columns + detail text, `label` styling) and need the same
   mobile treatment (stack to a 2-line card instead of a fixed-width row).
   Extract a shared `SignalRow` component into `src/components/` so the
   responsive logic is written once, not duplicated.

## Design

### `useIsMobile()` hook

New file: `src/lib/useIsMobile.ts`.

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

Every screen and `NavBar` call this hook and branch their existing inline
`style={{ ... }}` objects on the returned boolean. No new CSS files, no
`@media` blocks.

### Navigation (`NavBar.tsx`)

- Extract the current pill-row `<div>` into a `NavLinks` sub-component reused
  by both modes (top bar on desktop, bottom bar on mobile) so link markup
  isn't duplicated.
- Mobile top bar: logo only, height reduced to 44px, same
  `background`/`backdropFilter`/`borderBottom` treatment.
- Mobile bottom bar: fixed to viewport bottom, full width, same
  surface/border treatment as the current pill container, `NavLinks` spread
  to fill the width (`flex: 1` per link) instead of the compact pill group.
- `App.tsx` (or a shared layout wrapper) adds `paddingBottom` to the routed
  content area on mobile equal to the bottom bar's height + safe-area inset,
  so the last section of any screen isn't obscured.

### `Network.tsx`

- Header row (`FilterChip` group + search input + `ViewToggle`): `flexDirection: isMobile ? 'column' : 'row'`, `alignItems: isMobile ? 'stretch' : 'center'`.
- Search `<input>`: `minWidth` dropped, `width: '100%'` on mobile.
- `ViewToggle` / `view` state: on mobile, `view` is forced to `'cards'` and the toggle UI is not rendered (map view unreachable, no dead state).
- Card grid: unchanged.
- Root padding: `padding: isMobile ? 16 : 32`.

### `Pulse.tsx`

- Signal grid: `gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)'`.
- `WeekTable` rows: replaced by `<SignalRow>` (see below).
- Root padding: `padding: isMobile ? 16 : 32`.

### `ContactDetail.tsx`

- Outer container: `flexDirection: isMobile ? 'column' : 'row'`.
- `<aside>`: `width: isMobile ? '100%' : 344`, `position: isMobile ? 'static' : 'sticky'` (drop `top: 84` on mobile).
- Relationship pipeline buttons: on mobile, reduce `padding` (e.g. `'8px 6px'` vs `'11px 10px'`) and the stage-label `fontSize` (e.g. `11` vs `12`) so all 4 fit; grid stays 4-across.
- Signal-history rows: replaced by `<SignalRow>`.
- Root padding: `padding: isMobile ? 16 : 32`.

### `Profile.tsx`

- Root grid: `gridTemplateColumns: isMobile ? '1fr' : '344px minmax(0,1fr)'`.
- `<aside>`: same `position`/`top` treatment as ContactDetail.
- Root padding: `padding: isMobile ? 16 : 32`.
- The two `auto-fit` grids and "Waiting on you" cards: unchanged.

### `Import.tsx`

- CSV preview `<table>`: wrap in `<div style={{ overflowX: 'auto' }}>`.
- Root `maxWidth: 760` stays; root padding: `padding: isMobile ? 16 : 32`.
- No other changes.

### `SignalRow` component

New file: `src/components/SignalRow.tsx`. Takes the fields both call sites
already have (date, contact link, kind label, detail text) and renders:

- **Desktop:** the current horizontal flex with fixed-width columns
  (unchanged visual output from today).
- **Mobile:** a stacked 2-line layout — line 1 is contact name + kind label
  (`justify-content: space-between`), line 2 is date + detail text — using
  the same `label` token styling.

Both `ContactDetail.tsx`'s signal-history list and `Pulse.tsx`'s
`WeekTable` are updated to render `<SignalRow>` instead of their inline row
markup.

## Testing

No test framework exists in this repo. Verification per change:

1. `npm run build` (runs `tsc -b`) — typecheck passes, no `any`.
2. `npm run lint` (`oxlint`) — passes.
3. Manual check in the browser at a phone width (Chrome device toolbar,
   e.g. 375×812) and at a desktop width (e.g. 1440×900), for every screen
   touched by that change — confirms no overlap, no horizontal scroll on the
   page body, bottom nav doesn't obscure content, existing desktop layout is
   pixel-identical to before.

No unit tests are added — introducing a test framework is out of scope for
this change.

## Out of scope

- PWA manifest / service worker / installability.
- Native app (React Native, Capacitor, etc.).
- Rebuilding `NetworkMap` to work on mobile.
- Touch-optimized redesign of the Import column-mapping flow.
- Tablet-specific breakpoint.
- Any change to `contact_score` or other scoring/data-model behavior.
