# Northstar

A relationship-priority tool for a solo B2B consultant. It ingests LinkedIn
engagement exports and answers one question: who should I contact this week, and why.

## Non-negotiables
- Single user, NO AUTH yet. Every table has user_id defaulting to
  '00000000-0000-0000-0000-000000000001'. Never remove that column.
- Priority scoring lives in the Postgres view `contact_score`. Never
  reimplement scoring in TypeScript.
- Supabase client is created once in src/lib/supabase.ts.
- No CSS framework. Inline styles or one small tokens file. Dark UI.
- No component library. No state manager beyond React state + a couple of hooks.
- TypeScript strict. No `any`.

## Visual language
Background #080908. Surfaces: rgba(255,255,255,.04) with 1px rgba(255,255,255,.07)
borders, radius 14-18px. Accent green #4FE39B, secondary lime #D8F26A.
Text #E9EDE9, muted #8A928B, dim #5E665F.
Body font 'Space Grotesk'; all-caps labels in 'IBM Plex Mono', 10-11px, letter-spacing .12em.

## Data model
contact, signal, note, stage_event, app_user + view contact_score. See db/schema.sql.
Stages in order: silent → warming → contacted → conversation. dormant is a side state.

## Screens (build in this order, one per session)
1. /network   — contact grid, sorted by contact_score.score desc, filter by stage
2. /import    — CSV drop + column mapping + upsert
3. /pulse     — three columns of unhandled signals + week table
4. /contact/:id — detail: stage pipeline, notes, signal history
5. /profile   — my own profile + counts

## What NOT to build until someone pays
- Email sending or drafting with AI
- Calendar / event sync
- Automatic enrichment or scraping
- Teams, sharing, permissions
