# Admin Simulated Notifications — Design

## Context

`/admin` already lets the user toggle which `SignalKind`s (reaction/comment/job_change/funding/post_intent) count as "actionable" on Pulse, and which kinds they want to be notified about (a stored preference with no delivery mechanism — see CLAUDE.md's ban on building email/notification delivery until someone pays).

User feedback, verbatim intent distilled from conversation:
- The current Notifications toggle "just doesn't work" — investigated (systematic-debugging): it's not a bug, the chips work and persist correctly. The gap is that nothing ever *visibly* fires when a notification-worthy signal happens, because there's no delivery layer at all.
- The user wants two things: (1) target notifications at specific **people** (contacts), not just signal kinds, and (2) see something that looks like notifications actually happening — but explicitly **simulated/fabricated**, not real delivery (confirmed via clarifying questions: no email, no push, fabricated demo data rather than real signal data).

This spec covers both, scoped to stay inside CLAUDE.md's constraints: no email sending, no real delivery mechanism, no reimplementation of `contact_score` scoring logic, single-user/no-auth.

## Requirements (confirmed via clarifying questions)

1. **Per-contact watchlist**: alongside the existing kind toggles, the user can add specific contacts to a "notify me about this person no matter what they do" watchlist.
2. **Simulated feed on `/admin`**: a self-updating panel that fabricates plausible-looking notification events (real contact names, made-up phrasing) — not real signal data, not delivered anywhere else in the app, purely a demo/preview surface on the Admin screen itself.
3. Feed reacts live to current (unsaved) toggle state — no need to click Save first to see it react.
4. Everything else about the existing Admin screen (Pulse actionable-kinds section, kind-based Notifications section, Save button writing to `app_user`) stays as-is; this only adds to it.

## Data Model

One new column on `app_user`:

```sql
notify_contact_ids uuid[] not null default array[]::uuid[]
```

No check constraint (unlike `pulse_actionable_kinds`/`notify_kinds`, these are arbitrary contact references, not a small enum — a check against every valid contact id isn't practical and isn't how the rest of this schema validates foreign-ish references, e.g. `stage_event.from_stage` also has no such constraint).

`AppUser` (`src/lib/types.ts`) gains `notify_contact_ids: string[]`.

## Contact Watchlist UI

New `Section` on `/admin`, below the existing "Notifications" section. Reuses `useContactsWithScore` (already used identically by `Network.tsx` for "give me the contact list") rather than writing a new fetch — the extra `contact_score` join it pulls is unused here but negligible for a single-user dataset, and avoiding a second data-fetching pattern in the same screen is worth more than the trivial extra query cost.

- A search input (styled like `Profile.tsx`'s established `inputStyle` constant) filtering the contact list by name, case-insensitive substring match, shown only while the search box is non-empty (avoids dumping the full ~25-contact list into a permanently-visible dropdown).
- Each match not already on the watchlist renders as a clickable row; clicking adds its `id` to the watchlist state and clears the search box.
- Currently-watchlisted contacts render below as removable chips (name only; company omitted for brevity) with an inline × to remove.

## Simulated Notification Feed

New `Section`, "Simulated notifications", rendering a small self-contained subcomponent that:

- Receives the current (possibly unsaved) `notifyKinds: SignalKind[]`, `watchlist: ContactWithScore[]`, and the full `contacts: ContactWithScore[]` list as props from `Admin()`.
- Every 5 seconds, fabricates one new event by picking a random source pool:
  - **General pool** (available when `notifyKinds.length > 0`): a random contact from the full list + a random kind from `notifyKinds`.
  - **Watchlist pool** (available when `watchlist.length > 0`): a random watchlisted contact + a random kind from *all* five kinds (watchlisting means "notify me regardless of what they do").
  - If both pools are available, pick one at random each tick; if only one is available, use it; if neither is available, skip the tick (no event, no crash).
- Each kind has 2 canned phrase templates (defined as a local constant) — e.g. job_change: "Changed jobs to a new company" / "Started a new role" — picked at random per event, so the feed doesn't repeat identical text back to back predictably.
- New events prepend to a capped list (keep the newest 8); each event is stamped with the wall-clock time it was fabricated (`toLocaleTimeString`), not a relative "Xm ago" that would need its own re-render timer — simpler and avoids a second interval.
- Empty state ("Enable a kind or watch someone to see notifications here.") when neither pool is available, instead of ticking silently forever.
- The interval is cleaned up on unmount and restarts whenever `notifyKinds`/`watchlist` change (simplest correct approach — no ref juggling needed for a low-frequency 5s tick).

This is entirely client-side and in-memory — no writes to the `signal` table, so `contact_score` and the real Pulse screen are provably unaffected by the simulation (the rejected alternative — seeding fake rows into `signal` — was ruled out for exactly this reason).

## Save

The existing Save button's single `update` call gains one more field:

```ts
await supabase
  .from('app_user')
  .update({
    pulse_actionable_kinds: pulseKinds,
    notify_kinds: notifyKinds,
    notify_contact_ids: notifyContactIds,
  })
  .eq('id', DEFAULT_USER_ID)
```

## Out of Scope (explicitly, per this spec)

- Any real delivery mechanism (email, push, in-app toast/banner outside the Admin screen itself).
- Per-contact **and** per-kind combinations (e.g. "notify me about Job Change and Funding for Sophie, but only Comment for Adam") — the watchlist is "notify about this person for anything," a coarser rule than that. If finer-grained targeting is wanted later, that's a follow-up.
- Using real signal data to drive the feed — explicitly fabricated per the user's choice.

## Testing / Verification

No test framework in this repo. Verification is `npm run build`, `npm run lint`, and manual browser checks: search-and-add a contact, remove a contact, toggle notification kinds and watch the simulated feed react (both pools independently and combined), confirm the empty state when both are off, confirm Save persists `notify_contact_ids` across a reload, confirm nothing in `/pulse` or `/network` changes as a result of the simulated feed running (proving no real data was touched).
