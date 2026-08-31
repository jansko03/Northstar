# Network Filter Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visual clutter on `/network` by giving the screen a clear hierarchy (title/count, then utilities, then filters) and by visually grouping the stage filter chips according to Northstar's own stage model, instead of six equal-weight buttons and a search box all competing in one row.

**Architecture:** `src/screens/Network.tsx` is the only file touched. The single combined header row (filter chips + search + view toggle, all inline) is split into two stacked rows: an identity row (page title + contact count on the left, search + view toggle on the right) and a dedicated filter row below it. Within the filter row, chips are grouped with thin dividers into three visual clusters — `All`, the four ordered pipeline stages (`silent → warming → contacted → conversation`), and `Dormant` — matching the stage model documented in `CLAUDE.md` ("Stages in order: silent → warming → contacted → conversation. dormant is a side state"). No new components outside this file, no new state, no data-layer changes.

**Tech Stack:** React 19, TypeScript (strict), Vite, react-router-dom 7. No test framework in this repo — verification is `tsc -b` (via `npm run build`), `oxlint` (via `npm run lint`), and manual browser checks.

**Spec:** User feedback (Slovak): "ak by sa dalo v casti network tie all, silent atd spravit prehladnejsie, posobi to ze je toho strasne vela naraz na jednom mieste" — the Network screen's filter chips (All, Silent, etc.) should be made clearer/more organized; it currently feels like too much all at once in one place. No separate spec doc — this plan is the spec.

## Global Constraints

- Single user, no auth — `user_id` columns untouched (this plan touches no data model or Supabase code).
- Priority scoring stays in the `contact_score` Postgres view — this plan does not touch scoring, sorting, or filtering logic, only layout/grouping of the existing filter chips.
- No CSS framework. Inline styles or `src/lib/tokens.ts` only — no new `.css` files.
- No component library, no state manager beyond React state + hooks.
- TypeScript strict. No `any`.
- No test framework is introduced. Every task's verification is: `npm run build` (typecheck) passes, `npm run lint` passes, and a manual check in the browser at 1440×900 (desktop) and 375×812 (mobile), reusing the `useIsMobile()` breakpoint already in this file.
- Visual tokens (`color`, `font`, `radius`, `label` in `src/lib/tokens.ts`) are unchanged — this plan reuses them, doesn't redefine them.
- Existing filter/search behavior (`stageFilter`, `search`, `counts`, `filtered`) is unchanged — this is a layout/grouping change only, no new filtering semantics.

---

### Task 1: Split the header into an identity row and a filter row

**Files:**
- Modify: `src/screens/Network.tsx:142-219` (the `return (...)` block of `Network()`)

**Interfaces:**
- Consumes: existing `counts`, `stageFilter`, `search`, `view`, `isMobile`, `filtered`, `stages` (unchanged in this task), `FilterChip`, `ViewToggle` — all already defined in this file.
- Produces: no new exports; internal JSX restructure only. Task 2 builds on this task's output.

- [ ] **Step 1: Replace the `return` block in `Network()`**

In `src/screens/Network.tsx`, replace the full `return (...)` block of `export function Network()` (currently lines 142-219) with:

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
        <div>
          <div style={{ fontFamily: font.body, fontSize: 20, fontWeight: 600, color: color.text }}>
            Network
          </div>
          <div style={{ ...label, color: color.dim, marginTop: 4 }}>
            {counts.all} {counts.all === 1 ? 'contact' : 'contacts'}
          </div>
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

The only functional change versus the current file: the filter chips are no longer inside the same flex row as the search box and view toggle — they move to their own row underneath, and a "Network" title plus a live contact count appear where the chips used to sit.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

Run: `npm run lint`
Expected: exits 0, no oxlint errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/network` in a browser.

At **1440×900** (desktop): confirm you now see, top to bottom: a "NETWORK" title with a small contact count underneath it and the search box + Cards/Map toggle on the same row to the right; then, on its own row below, the six filter chips (All, Silent, Warming, Contacted, Conversation, Dormant); then the contact grid. Confirm filtering and search still work exactly as before (clicking a chip filters the grid, typing in search narrows it further).

At **375×812** (mobile): confirm the title/count block stacks above the full-width search box (view toggle stays hidden, as before), and the filter chips still wrap onto their own row(s) beneath that. No horizontal overflow.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Network.tsx
git commit -m "refactor: separate Network page identity from its filter row"
```

---

### Task 2: Group filter chips by stage model (All / pipeline / Dormant)

**Files:**
- Modify: `src/screens/Network.tsx:12` (the `stages` const)
- Modify: `src/screens/Network.tsx` (the filter row added in Task 1)
- Modify: `src/screens/Network.tsx:255-287` (the `FilterChip` component)

**Interfaces:**
- Consumes: Task 1's filter row (`<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>...</div>`); `Stage`, `stageColor`, `stageLabel` from `../lib/tokens` / `../lib/types` (already imported).
- Produces: `FilterChip` gains an optional `muted?: boolean` prop — no other file consumes `FilterChip`, so this is a self-contained signature change. A new local `FilterDivider` component, used only within this file.

- [ ] **Step 1: Rename `stages` to `pipelineStages` and drop `dormant` from it**

Replace line 12:

```ts
const stages: Stage[] = ['silent', 'warming', 'contacted', 'conversation', 'dormant']
```

with:

```ts
const pipelineStages: Stage[] = ['silent', 'warming', 'contacted', 'conversation']
```

This matches `CLAUDE.md`'s documented model: `silent → warming → contacted → conversation` is the ordered pipeline; `dormant` is a side state and is now handled explicitly in the JSX instead of being folded into the same array.

- [ ] **Step 2: Add a `FilterDivider` component**

Add this new function anywhere below `Network()` (for example, directly above `function FilterChip`):

```tsx
function FilterDivider() {
  return (
    <div
      aria-hidden
      style={{ width: 1, height: 18, background: color.border, flexShrink: 0, alignSelf: 'center' }}
    />
  )
}
```

- [ ] **Step 3: Give `FilterChip` an optional `muted` prop**

Replace the `FilterChip` component (currently lines 255-287):

```tsx
function FilterChip({
  active,
  onClick,
  text,
  count,
  muted,
}: {
  active: boolean
  onClick: () => void
  text: string
  count: number
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...label,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? color.accent : color.border}`,
        background: active ? 'rgba(79,227,155,.08)' : color.surface,
        color: active ? color.accent : muted ? color.dim : color.muted,
        opacity: muted && !active ? 0.7 : 1,
        cursor: 'pointer',
      }}
    >
      {text}
      <span style={{ color: active ? color.accent : color.dim }}>{count}</span>
    </button>
  )
}
```

`muted` only changes the resting (non-active) appearance — an active `Dormant` filter still shows full accent-green, same as any other active chip.

- [ ] **Step 4: Update the filter row to use the three groups**

Replace the filter row added in Task 1:

```tsx
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
```

with:

```tsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChip
          active={stageFilter === 'all'}
          onClick={() => setStageFilter('all')}
          text="All"
          count={counts.all}
        />
        <FilterDivider />
        {pipelineStages.map((s) => (
          <FilterChip
            key={s}
            active={stageFilter === s}
            onClick={() => setStageFilter(s)}
            text={stageLabel[s]}
            count={counts[s]}
          />
        ))}
        <FilterDivider />
        <FilterChip
          active={stageFilter === 'dormant'}
          onClick={() => setStageFilter('dormant')}
          text={stageLabel.dormant}
          count={counts.dormant}
          muted
        />
      </div>
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run build`
Expected: exits 0, no TypeScript errors (in particular, no leftover reference to the old `stages` name).

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `/network`.

At **1440×900**: confirm the filter row now reads, left to right: `All` chip, a thin vertical divider, the four pipeline chips (`Silent`, `Warming`, `Contacted`, `Conversation`) clustered together, another thin divider, then `Dormant` rendered slightly dimmer than the others when inactive. Click `Dormant` and confirm it still filters the grid to dormant contacts and turns full accent-green while active (same visual weight as any other active chip). Click back to `All` and confirm the full contact count returns.

At **375×812**: confirm the same three groups still read clearly when the row wraps onto multiple lines (dividers wrap with their neighboring group rather than floating alone at a line break — if a divider does end up alone at a wrap point, that's acceptable since it's a 1px hairline with no interactive purpose).

- [ ] **Step 7: Commit**

```bash
git add src/screens/Network.tsx
git commit -m "feat: group Network filter chips by stage model, separate Dormant"
```
