-- habits table schema alignment with app model
-- The app writes a per-goal accent color for cards/charts.

alter table if exists habits
  add column if not exists color text;

