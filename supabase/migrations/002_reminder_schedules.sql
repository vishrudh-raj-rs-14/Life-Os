-- Reminder schedules: per-habit push reminder times synced from the client.
-- Each row links a push_subscription endpoint to a habit's reminder time + days.

create table if not exists reminder_schedules (
  id          text primary key,
  endpoint    text not null,
  habit_id    text not null,
  habit_title text not null,
  remind_time text not null,          -- "HH:MM" in user's local time (IST)
  days        integer[] not null,     -- days of week [0..6], 0=Sun
  updated_at  timestamptz default now(),
  unique(endpoint, habit_id)
);

alter table reminder_schedules enable row level security;

-- Service role key bypasses RLS; anon key reads/writes via these policies:
create policy "service_all" on reminder_schedules
  for all using (true) with check (true);
