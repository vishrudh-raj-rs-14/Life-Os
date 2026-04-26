-- Adherence (commitment, weekly review, trust metadata) + habit ramp (progressive targets)

alter table if exists user_profile
  add column if not exists adherence_json jsonb;

alter table if exists habits
  add column if not exists ramp_json jsonb;

notify pgrst, 'reload schema';
