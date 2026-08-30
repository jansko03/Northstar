-- Northstar schema — single-user MVP, no auth.
-- user_id exists on every table but defaults to one fixed owner.
-- When auth is added later, swap the default for auth.uid() and enable RLS.

create extension if not exists "pgcrypto";

create table app_user (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text,
  looking_for text
);

insert into app_user (id, name, headline)
values ('00000000-0000-0000-0000-000000000001', 'Me', 'B2B consultant');

create table contact (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id)
                default '00000000-0000-0000-0000-000000000001',
  name          text not null,
  role_title    text,
  company       text,
  linkedin_url  text,
  email         text,
  contact_type  text default 'unknown'
                check (contact_type in ('client','partner','channel','peer','unknown')),
  stage         text default 'silent'
                check (stage in ('silent','warming','contacted','conversation','dormant')),
  last_touch_at date,
  created_at    timestamptz default now(),
  unique (user_id, linkedin_url)
);

-- one row per engagement or event picked up from an import
create table signal (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contact(id) on delete cascade,
  kind        text not null,          -- 'reaction' | 'comment' | 'job_change' | 'funding' | 'post_intent'
  detail      text,
  occurred_at date not null default current_date,
  handled_at  timestamptz,            -- set when you press DONE in the Pulse column
  created_at  timestamptz default now()
);

create table note (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contact(id) on delete cascade,
  body        text not null,
  channel     text default 'note',
  created_at  timestamptz default now()
);

create table stage_event (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references contact(id) on delete cascade,
  from_stage  text,
  to_stage    text not null,
  created_at  timestamptz default now()
);

create index on signal (contact_id, occurred_at desc);
create index on signal (handled_at);
create index on contact (user_id, stage);

-- Priority scoring view — the only real IP in the product.
-- Kept in SQL so weights can be tuned in the Supabase editor without redeploying.
create or replace view contact_score as
with agg as (
  select
    c.id,
    count(s.id) filter (where s.occurred_at > current_date - 30)          as recent_signals,
    count(s.id) filter (where s.kind = 'comment'
                          and s.occurred_at > current_date - 90)          as comments_90d,
    count(s.id) filter (where s.kind in ('job_change','funding','post_intent')
                          and s.handled_at is null
                          and s.occurred_at > current_date - 21)          as open_events,
    max(s.occurred_at)                                                     as last_signal_at
  from contact c
  left join signal s on s.contact_id = c.id
  group by c.id
)
select
  c.id,
  c.user_id,
  -- 0..100, all weights in one place on purpose
  least(100, greatest(0,
      least(30, a.recent_signals * 6)                                    -- attention
    + least(20, a.comments_90d  * 7)                                     -- effort, not just a like
    + (a.open_events * 15)                                               -- a reason to write today
    + case c.stage
        when 'conversation' then 20
        when 'contacted'    then 14
        when 'warming'      then 8
        when 'silent'       then 4
        else -10 end                                                     -- dormant sinks
    + case
        when c.last_touch_at is null then 6                              -- never spoken = opportunity
        when c.last_touch_at < current_date - 120 then -8                -- gone cold
        when c.last_touch_at > current_date - 14  then -6                -- just spoke, leave them alone
        else 0 end
  ))::int as score,
  a.recent_signals,
  a.open_events,
  a.last_signal_at,
  case
    when a.open_events > 0 then 'act_now'
    when a.recent_signals >= 3 then 'keep_warm'
    when a.recent_signals >= 1 then 'nurture'
    else 'parked'
  end as tier
from contact c
join agg a on a.id = c.id;
