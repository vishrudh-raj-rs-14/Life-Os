-- logs table schema alignment with app model
-- (goal_id is legacy but still used in UI + focus credit; xp_awarded used for XP math)

alter table if exists logs
  add column if not exists goal_id text,
  add column if not exists xp_awarded integer;

