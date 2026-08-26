-- Demo seed data for the single-user MVP.
-- Safe to re-run: wipes the default user's contacts first (cascades to
-- their signals/notes/stage_events), then inserts a fresh set. All date
-- offsets are relative to current_date so the contact_score distribution
-- stays realistic (spanning act_now / keep_warm / nurture / parked)
-- whenever this is run, not just on the day it was written.

delete from contact where user_id = '00000000-0000-0000-0000-000000000001';

with new_contacts as (
  insert into contact (user_id, name, role_title, company, linkedin_url, contact_type, stage, last_touch_at)
  values
    ('00000000-0000-0000-0000-000000000001', 'Martin Novák', 'CTO', 'NovaPay', 'https://linkedin.com/in/martin-novak-novapay', 'client', 'conversation', current_date - 10),
    ('00000000-0000-0000-0000-000000000001', 'Zuzana Kováčová', 'Head of Marketing', 'BrightLoop', 'https://linkedin.com/in/zuzana-kovacova-brightloop', 'partner', 'contacted', current_date - 45),
    ('00000000-0000-0000-0000-000000000001', 'Peter Horváth', 'VP Sales', 'Konštrukta Digital', 'https://linkedin.com/in/peter-horvath-konstrukta', 'client', 'warming', null),
    ('00000000-0000-0000-0000-000000000001', 'Jana Dvořáková', 'Founder', 'Dvořák Consulting', 'https://linkedin.com/in/jana-dvorakova-consulting', 'peer', 'silent', null),
    ('00000000-0000-0000-0000-000000000001', 'Michal Baláž', 'Procurement Manager', 'SlovCorp Industries', 'https://linkedin.com/in/michal-balaz-slovcorp', 'client', 'dormant', current_date - 160),
    ('00000000-0000-0000-0000-000000000001', 'Lucia Szabová', 'Growth Lead', 'PixelHatch', 'https://linkedin.com/in/lucia-szabova-pixelhatch', 'channel', 'warming', current_date - 20),
    ('00000000-0000-0000-0000-000000000001', 'Tomáš Procházka', 'CEO', 'Procházka & Partners', 'https://linkedin.com/in/tomas-prochazka-partners', 'client', 'conversation', current_date - 6),
    ('00000000-0000-0000-0000-000000000001', 'Katarína Molnárová', 'Partner', 'Alpine Capital', 'https://linkedin.com/in/katarina-molnarova-alpine', 'partner', 'contacted', current_date - 35),
    ('00000000-0000-0000-0000-000000000001', 'Ondřej Svoboda', 'Head of Ops', 'Czechly', 'https://linkedin.com/in/ondrej-svoboda-czechly', 'client', 'silent', null),
    ('00000000-0000-0000-0000-000000000001', 'Veronika Kučerová', 'VP Product', 'Nimbus Cloud', 'https://linkedin.com/in/veronika-kucerova-nimbus', 'peer', 'warming', current_date - 70),
    ('00000000-0000-0000-0000-000000000001', 'Filip Varga', 'Founder', 'Varga Labs', 'https://linkedin.com/in/filip-varga-labs', 'client', 'contacted', current_date - 12),
    ('00000000-0000-0000-0000-000000000001', 'Simona Nováková', 'Marketing Director', 'HelioTech', 'https://linkedin.com/in/simona-novakova-heliotech', 'channel', 'silent', null),
    ('00000000-0000-0000-0000-000000000001', 'Radovan Kolár', 'Managing Partner', 'Kolár Legal', 'https://linkedin.com/in/radovan-kolar-legal', 'peer', 'dormant', current_date - 190),
    ('00000000-0000-0000-0000-000000000001', 'Barbora Poláková', 'Head of People', 'StackWorks', 'https://linkedin.com/in/barbora-polakova-stackworks', 'unknown', 'silent', null),
    ('00000000-0000-0000-0000-000000000001', 'Adam Šimko', 'CTO', 'Šimko Systems', 'https://linkedin.com/in/adam-simko-systems', 'client', 'conversation', current_date - 8),
    ('00000000-0000-0000-0000-000000000001', 'James Whitfield', 'VP Sales', 'Whitfield & Co', 'https://linkedin.com/in/james-whitfield-co', 'client', 'contacted', current_date - 50),
    ('00000000-0000-0000-0000-000000000001', 'Sophie Laurent', 'Partner', 'Laurent Ventures', 'https://linkedin.com/in/sophie-laurent-ventures', 'partner', 'conversation', current_date - 13),
    ('00000000-0000-0000-0000-000000000001', 'Marco Ferrari', 'Head of BD', 'Ferrari Digitale', 'https://linkedin.com/in/marco-ferrari-digitale', 'channel', 'warming', current_date - 25),
    ('00000000-0000-0000-0000-000000000001', 'Anna Larsson', 'CEO', 'Larsson Nordic', 'https://linkedin.com/in/anna-larsson-nordic', 'client', 'dormant', current_date - 170),
    ('00000000-0000-0000-0000-000000000001', 'David Cohen', 'Founder', 'Cohen Analytics', 'https://linkedin.com/in/david-cohen-analytics', 'peer', 'warming', null),
    ('00000000-0000-0000-0000-000000000001', 'Priya Sharma', 'VP Growth', 'Sharma Cloud', 'https://linkedin.com/in/priya-sharma-cloud', 'client', 'contacted', current_date - 40),
    ('00000000-0000-0000-0000-000000000001', 'Lukas Weber', 'Head of Procurement', 'Weber Industrie', 'https://linkedin.com/in/lukas-weber-industrie', 'client', 'silent', current_date - 150),
    ('00000000-0000-0000-0000-000000000001', 'Chen Wei', 'Founder', 'Wei Dynamics', 'https://linkedin.com/in/chen-wei-dynamics', 'peer', 'warming', current_date - 18),
    ('00000000-0000-0000-0000-000000000001', 'Isabel Santos', 'Marketing Lead', 'Santos Digital', 'https://linkedin.com/in/isabel-santos-digital', 'channel', 'contacted', current_date - 60),
    ('00000000-0000-0000-0000-000000000001', 'Ryan O''Connell', 'Partner', 'O''Connell Capital', 'https://linkedin.com/in/ryan-oconnell-capital', 'partner', 'conversation', current_date - 9)
  returning id, name
),
sig as (
  insert into signal (contact_id, kind, detail, occurred_at, handled_at)
  select nc.id, v.kind, v.detail, current_date - v.days_ago, case when v.handled then now() else null end
  from new_contacts nc
  join (values
    -- open events (unhandled, recent -> these five land in the "act_now" tier)
    ('Peter Horváth', 'job_change', 'Moved from Head of IT to VP Sales at Konštrukta Digital', 5, false),
    ('David Cohen', 'job_change', 'Announced as Founder-in-Residence, spinning up Cohen Analytics', 15, false),
    ('Marco Ferrari', 'funding', 'Ferrari Digitale closed a €4M Series A', 10, false),
    ('Chen Wei', 'post_intent', 'Posted about evaluating new analytics vendors', 18, false),
    ('Barbora Poláková', 'post_intent', 'Asked the network for consulting recommendations', 3, false),
    -- older events, already handled
    ('Lukas Weber', 'job_change', 'Promoted to Head of Procurement at Weber Industrie', 40, true),
    ('Isabel Santos', 'funding', 'Santos Digital closed a seed round', 55, true),
    -- keep_warm: 3+ reactions/comments in the last 30 days
    ('Martin Novák', 'reaction', 'Liked your post about pricing strategy', 4, false),
    ('Martin Novák', 'comment', 'Commented asking for a follow-up call', 9, false),
    ('Martin Novák', 'reaction', 'Liked your Q3 hiring update', 22, false),
    ('Tomáš Procházka', 'reaction', 'Liked your post on client retention', 2, false),
    ('Tomáš Procházka', 'comment', 'Left a comment on your case study', 14, false),
    ('Tomáš Procházka', 'comment', 'Asked a question about your workshop', 27, false),
    ('Sophie Laurent', 'reaction', 'Liked your funding announcement', 6, false),
    ('Sophie Laurent', 'reaction', 'Liked your article on B2B sales cycles', 19, false),
    ('Sophie Laurent', 'comment', 'Commented sharing her own experience', 28, false),
    ('Adam Šimko', 'comment', 'Commented on your product roadmap post', 3, false),
    ('Adam Šimko', 'reaction', 'Liked your engineering culture post', 11, false),
    ('Adam Šimko', 'reaction', 'Liked your conference recap', 24, false),
    ('Katarína Molnárová', 'reaction', 'Liked your investor update', 8, false),
    ('Katarína Molnárová', 'comment', 'Commented with a warm intro offer', 17, false),
    ('Katarína Molnárová', 'comment', 'Asked about your next fund', 29, false),
    ('Veronika Kučerová', 'reaction', 'Liked your product launch post', 5, false),
    ('Veronika Kučerová', 'reaction', 'Liked your roadmap teaser', 13, false),
    ('Veronika Kučerová', 'comment', 'Commented on your hiring post', 21, false),
    -- nurture: 1-2 reactions/comments in the last 30 days
    ('Zuzana Kováčová', 'comment', 'Commented on your campaign results post', 12, false),
    ('Filip Varga', 'reaction', 'Liked your launch announcement', 9, false),
    ('Filip Varga', 'comment', 'Commented congratulating the team', 26, false),
    ('James Whitfield', 'reaction', 'Liked your quarterly update', 20, false),
    ('Priya Sharma', 'reaction', 'Liked your growth metrics post', 14, false),
    ('Priya Sharma', 'reaction', 'Liked your team offsite recap', 28, false),
    ('Ryan O''Connell', 'comment', 'Commented asking about your pricing model', 7, false),
    ('Lucia Szabová', 'reaction', 'Liked your partnership announcement', 10, false),
    ('Lucia Szabová', 'comment', 'Commented sharing a related article', 25, false),
    -- parked: older history only, nothing in the last 30 days
    ('Jana Dvořáková', 'comment', 'Commented on an old post about consulting rates', 55, false),
    ('Ondřej Svoboda', 'reaction', 'Liked a post from a few months back', 48, false),
    ('Radovan Kolár', 'comment', 'Commented on your legal-tech opinion piece', 58, false),
    ('Anna Larsson', 'reaction', 'Liked your Nordic expansion post', 52, false),
    ('Michal Baláž', 'comment', 'Commented on your procurement trends post', 59, false),
    ('Isabel Santos', 'reaction', 'Liked an older post about content strategy', 50, false)
  ) as v(name, kind, detail, days_ago, handled)
    on v.name = nc.name
  returning 1
)
select
  (select count(*) from new_contacts) as contacts_inserted,
  (select count(*) from sig) as signals_inserted;
