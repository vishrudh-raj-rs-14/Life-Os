-- Critical: RLS policies that only have USING do NOT allow INSERT unless they
-- also include WITH CHECK.
-- This migration makes core tables writable from the authenticated client.

-- user_profile
drop policy if exists "owner" on user_profile;
create policy "owner" on user_profile
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- goals
drop policy if exists "owner" on goals;
create policy "owner" on goals
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- habits
drop policy if exists "owner" on habits;
create policy "owner" on habits
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- logs
drop policy if exists "owner" on logs;
create policy "owner" on logs
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- sessions
drop policy if exists "owner" on sessions;
create policy "owner" on sessions
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

-- reminders
drop policy if exists "owner" on reminders;
create policy "owner" on reminders
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

