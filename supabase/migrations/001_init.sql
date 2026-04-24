-- Life OS — Supabase schema
-- Run this in the Supabase dashboard → SQL editor, or use `supabase db push`.

-- ────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- Helper: updated_at trigger
-- ────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = extract(epoch from now()) * 1000;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- user_profile
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists user_profile (
  id            text primary key,
  auth_user_id  uuid references auth.users(id) on delete cascade,
  handle        text not null unique,
  display_name  text not null,
  class_name    text not null default 'polymath',
  tone          text not null default 'coach',
  total_xp      integer not null default 0,
  streak_days   integer not null default 0,
  streak_freezes integer not null default 0,
  is_public     integer not null default 0,
  created_at    bigint not null,
  updated_at    bigint not null,
  deleted_at    bigint
);
alter table user_profile enable row level security;
create policy "owner" on user_profile for all using (auth.uid() = auth_user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- goals
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists goals (
  id                    text primary key,
  user_id               text not null,
  title                 text not null,
  description           text,
  why                   text,
  outcome               text,
  metric_label          text,
  metric_target         real,
  area                  text,
  color                 text not null default '#c9a96e',
  weekly_target_minutes integer not null default 0,
  review_cadence        text not null default 'weekly',
  archived              integer not null default 0,
  created_at            bigint not null,
  updated_at            bigint not null,
  deleted_at            bigint
);
alter table goals enable row level security;
create policy "owner" on goals for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- habits
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists habits (
  id             text primary key,
  user_id        text not null,
  goal_id        text references goals(id) on delete set null,
  title          text not null,
  kind           text not null default 'binary',
  unit           text,
  target         real not null default 1,
  target_mode    text not null default 'at-least',
  steps          jsonb,
  cadence        text not null default 'daily',
  custom_days    jsonb,
  cue            text,
  scheduled_time text,
  difficulty     integer not null default 2,
  archived       integer not null default 0,
  created_at     bigint not null,
  updated_at     bigint not null,
  deleted_at     bigint
);
alter table habits enable row level security;
create policy "owner" on habits for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- logs
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists logs (
  id         text primary key,
  user_id    text not null,
  habit_id   text not null references habits(id) on delete cascade,
  date       text not null,   -- yyyy-MM-dd
  value      real not null default 1,
  steps      jsonb,
  notes      text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
alter table logs enable row level security;
create policy "owner" on logs for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- sessions  (focus timer)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists sessions (
  id          text primary key,
  user_id     text not null,
  goal_id     text references goals(id) on delete set null,
  minutes     integer not null default 0,
  started_at  bigint not null,
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted_at  bigint
);
alter table sessions enable row level security;
create policy "owner" on sessions for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- reminders
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists reminders (
  id         text primary key,
  user_id    text not null,
  habit_id   text not null,
  time       text not null,
  tone       text not null default 'coach',
  enabled    integer not null default 1,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
alter table reminders enable row level security;
create policy "owner" on reminders for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- achievements
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists achievements (
  id           text primary key,
  user_id      text not null,
  key          text not null,
  unlocked_at  bigint not null,
  created_at   bigint not null,
  updated_at   bigint not null
);
alter table achievements enable row level security;
create policy "owner" on achievements for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- trackers  (progress photos, measurements, mood, custom)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists trackers (
  id         text primary key,
  user_id    text not null,
  goal_id    text references goals(id) on delete cascade,
  kind       text not null,
  name       text not null,
  unit       text,
  cadence    text not null default 'weekly',
  archived   integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
alter table trackers enable row level security;
create policy "owner" on trackers for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

create table if not exists tracker_entries (
  id         text primary key,
  user_id    text not null,
  tracker_id text not null references trackers(id) on delete cascade,
  date       text not null,
  value      real,
  notes      text,
  photo_url  text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
alter table tracker_entries enable row level security;
create policy "owner" on tracker_entries for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- ────────────────────────────────────────────────────────────────────────────
-- sync_queue  (not synced itself — local only)
-- ────────────────────────────────────────────────────────────────────────────
-- This table lives in Dexie only (local IndexedDB), no remote equivalent.

-- ────────────────────────────────────────────────────────────────────────────
-- Social: friendships, squads, squad_members, duels, feed_events, nudges
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists friendships (
  id           text primary key,
  from_user_id text not null,
  to_user_id   text not null,
  status       text not null default 'pending',
  created_at   bigint not null,
  updated_at   bigint not null
);
alter table friendships enable row level security;
create policy "participant" on friendships for all
  using (
    from_user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1)
    or
    to_user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1)
  );

-- Create squads first (no RLS policy that references squad_members yet)
create table if not exists squads (
  id          text primary key,
  name        text not null,
  invite_code text not null unique,
  owner_id    text not null,
  created_at  bigint not null,
  updated_at  bigint not null
);
alter table squads enable row level security;
-- owner can always read/write their own squad
create policy "owner_write" on squads for all
  using (owner_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- Create squad_members next (references squads)
create table if not exists squad_members (
  id         text primary key,
  squad_id   text not null references squads(id) on delete cascade,
  user_id    text not null,
  role       text not null default 'member',
  joined_at  bigint not null
);
alter table squad_members enable row level security;
create policy "member_read" on squad_members for select
  using (
    squad_id in (
      select squad_id from squad_members sm2
      where sm2.user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1)
    )
  );
create policy "self_write" on squad_members for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- Now add the squads "member" policy that references squad_members (table exists now)
create policy "member" on squads for select
  using (
    id in (
      select squad_id from squad_members
      where user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1)
    )
  );

create table if not exists feed_events (
  id         text primary key,
  user_id    text not null,
  squad_id   text references squads(id) on delete cascade,
  type       text not null,
  payload    jsonb,
  created_at bigint not null
);
alter table feed_events enable row level security;
create policy "squad_member_read" on feed_events for select
  using (
    squad_id in (
      select squad_id from squad_members
      where user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1)
    )
  );

-- Storage bucket for tracker photos
insert into storage.buckets (id, name, public)
values ('tracker-photos', 'tracker-photos', false)
on conflict do nothing;

create policy "owner_photos" on storage.objects for all
  using (
    bucket_id = 'tracker-photos'
    and (storage.foldername(name))[1] = (
      select id from user_profile where auth_user_id = auth.uid() limit 1
    )
  );

-- ─── push subscriptions (web push VAPID) ─────────────────────────────────────
create table if not exists push_subscriptions (
  id           bigserial primary key,
  endpoint     text unique not null,
  subscription jsonb not null,
  created_at   timestamptz default now()
);
alter table push_subscriptions enable row level security;
create policy "anon_insert_subscription" on push_subscriptions
  for insert with check (true);
