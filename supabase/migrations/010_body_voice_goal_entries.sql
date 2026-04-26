-- Body logs, voice notes (metadata), goal journal entries — cloud sync + R2 keys

create table if not exists body_logs (
  id                 text primary key,
  user_id            text not null,
  date               text not null,
  weight             real,
  notes              text,
  photo_storage_key  text,
  photo_mime_type    text,
  created_at         bigint not null,
  updated_at         bigint not null
);

create unique index if not exists body_logs_user_id_date_key on body_logs (user_id, date);
create index if not exists body_logs_user_id_date_idx on body_logs (user_id, date desc);

alter table body_logs enable row level security;

drop policy if exists "owner" on body_logs;
create policy "owner" on body_logs
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

create table if not exists voice_notes (
  id                  text primary key,
  user_id             text not null,
  title               text,
  duration_seconds    real not null default 0,
  date                text not null,
  audio_storage_key   text not null,
  audio_mime_type     text,
  created_at          bigint not null,
  updated_at          bigint not null,
  deleted_at          bigint
);

create index if not exists voice_notes_user_id_created_idx on voice_notes (user_id, created_at desc);
create index if not exists voice_notes_user_id_date_idx on voice_notes (user_id, date desc);

alter table voice_notes enable row level security;

drop policy if exists "owner" on voice_notes;
create policy "owner" on voice_notes
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

create table if not exists goal_entries (
  id                  text primary key,
  user_id             text not null,
  habit_id            text not null references habits(id) on delete cascade,
  date                text not null,
  note_text           text,
  photo_storage_key   text,
  photo_mime_type     text,
  created_at          bigint not null,
  updated_at          bigint not null,
  deleted_at          bigint
);

create index if not exists goal_entries_user_habit_date_idx on goal_entries (user_id, habit_id, date desc);

alter table goal_entries enable row level security;

drop policy if exists "owner" on goal_entries;
create policy "owner" on goal_entries
  for all
  using (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1))
  with check (user_id = (select id from user_profile where auth_user_id = auth.uid() limit 1));

notify pgrst, 'reload schema';
