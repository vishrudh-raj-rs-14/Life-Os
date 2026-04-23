# Compound — Gamified Habit & Goal Tracker

A mobile-first PWA that turns the time you put into your goals into XP, levels,
streaks and a compounding multiplier. Built with Next.js 16 (App Router),
TypeScript, Tailwind v4, Dexie (IndexedDB), Framer Motion, Recharts and
Supabase (optional).

Self-improvement RPG with brutal-honest reminders, weekly reviews, public
profiles, squads, accountability stakes and duels.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The app boots straight into onboarding the first time. Pick a class, choose a
notification tone, select starter quests, and you're playing.

## What's in here

- **Solo core** — fully working offline. Today screen, focus timer, goals,
  habits, stats, badges, weekly review, scheduled local notifications.
- **Cloud (optional)** — drop in Supabase env vars to enable sync, accounts
  and social. Without them, everything still works locally.
- **Social** — handles, friends, squads (private groups up to 8), accountability
  stakes, duels, public profiles at `/u/[handle]`.

## Architecture

```
src/
  app/
    (app)/          # bottom-nav screens (today / goals / focus / stats / squad)
    onboarding/     # first-run flow
    u/[handle]/     # shareable public profile
  components/       # UI primitives + screens
  lib/
    db/dexie.ts     # IndexedDB schema
    repo/           # repository interface + Dexie impl
    engine/         # XP, levels, streaks, compound multiplier, badges
    notifications/  # tone templates + in-app scheduler
    social/         # supabase client + offline sync queue
  store/            # Zustand slices
  types/            # shared TypeScript types
public/
  sw.js             # service worker (offline shell + web push)
  manifest.webmanifest
```

## Engine

- **XP for habits** = difficulty × count (8/14/22 for ★/★★/★★★)
- **XP for sessions** = `minutes × priority` where priority is `1.25` for
  goals with weekly targets > 5h.
- **Levels**: `xpForLevel(L) = floor(100 × (L-1)^1.5)`.
- **Streaks**: per-day, with monthly streak freezes.
- **Compounding multiplier**: 1.0× → 1.1× → 1.25× → 1.5× (cap) for consecutive
  weeks hitting a goal's weekly target.

## Optional cloud setup

Create a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The repository layer is offline-first. All writes go to Dexie immediately and
enqueue in `sync_queue`. A background loop flushes to Supabase whenever
online. Once configured, set up tables matching `src/types/index.ts` with
Row-Level Security so users only see their own rows (plus opt-in public fields
for friends/squad-mates).

## Notifications

The in-browser scheduler ticks every 30s and fires local `Notification`s when
a habit's scheduled time arrives, plus a 21:30 daily recap. Tones: **coach**,
**drill-sergeant**, **wise**. Real cross-device push uses Web Push (VAPID) +
Supabase edge function cron — wire it when you're ready.

## License

MIT
