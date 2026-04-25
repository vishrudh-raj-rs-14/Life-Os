-- Add fields used by Life OS daily XP bonus + streak bookkeeping.
-- Run this in Supabase SQL editor if you're not using supabase CLI.

alter table if exists user_profile
  add column if not exists daily_bonus_date text,
  add column if not exists daily_bonus_xp integer,
  add column if not exists last_active_date text;

