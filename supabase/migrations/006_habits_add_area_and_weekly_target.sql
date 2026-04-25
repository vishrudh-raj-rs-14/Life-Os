-- habits table schema alignment with app model
-- Adds LifeArea + weekly target (due count / sessions per week).

alter table if exists habits
  add column if not exists area text,
  add column if not exists weekly_target integer;

