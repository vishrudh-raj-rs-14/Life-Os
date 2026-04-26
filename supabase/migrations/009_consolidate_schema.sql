-- Cloud-first schema consolidation for the flat "goals are habits" model.
-- Run this after migrations 001-008.

-- The app now treats a goal as a habit. Keep legacy goal_id columns for
-- compatibility, but remove FKs to the old goals table so writes cannot fail.
alter table if exists habits
  drop constraint if exists habits_goal_id_fkey;

alter table if exists sessions
  drop constraint if exists sessions_goal_id_fkey;

-- Persist level alongside total_xp so reset/profile state is explicit in cloud.
alter table if exists user_profile
  add column if not exists level integer not null default 1;

-- Align nullable/default behavior with the app model.
alter table if exists logs
  alter column xp_awarded set default 0;

update logs
set xp_awarded = 0
where xp_awarded is null;

alter table if exists logs
  alter column xp_awarded set not null;

alter table if exists reminders
  add column if not exists deleted_at bigint;

-- RLS: remaining user-owned tables need WITH CHECK for client inserts/upserts.
drop policy if exists "owner" on achievements;
create policy "owner" on achievements
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

drop policy if exists "owner" on trackers;
create policy "owner" on trackers
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

drop policy if exists "owner" on tracker_entries;
create policy "owner" on tracker_entries
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';

