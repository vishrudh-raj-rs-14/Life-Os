-- sessions table schema alignment with app model
-- Focus history stores end time, notes, and XP metadata.

alter table if exists sessions
  add column if not exists ended_at bigint,
  add column if not exists notes text,
  add column if not exists xp_awarded integer;

