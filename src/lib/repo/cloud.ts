"use client";

import type { Habit, Log, Reminder, Session, UserProfile } from "@/types";
import type { Repository } from "./index";
import { DexieRepository } from "./dexie";
import { supabaseBrowser } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";

// Cloud-first for core tables (user, habits, logs, sessions, reminders).
// Dexie remains the offline cache fallback.

// ─── Mappers: local (camelCase) <-> Supabase (snake_case) ────────────────────

function isRemoteNewer<T extends { updatedAt?: number }>(remote: T, local?: T) {
  return !local || (local.updatedAt ?? 0) <= (remote.updatedAt ?? 0);
}

function mapUserFromRow(r: any): UserProfile {
  return {
    userId: r.id,
    handle: r.handle,
    displayName: r.display_name,
    className: r.class_name,
    level: r.level ?? 1,
    totalXp: r.total_xp ?? 0,
    streakDays: r.streak_days ?? 0,
    streakFreezes: r.streak_freezes ?? 0,
    lastActiveDate: r.last_active_date ?? undefined,
    isPublic: (r.is_public ?? 0) as 0 | 1,
    tone: r.tone ?? "coach",
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
    dailyBonusDate: r.daily_bonus_date ?? undefined,
    dailyBonusXp: r.daily_bonus_xp ?? undefined,
  };
}

function mapUserToRow(u: UserProfile, authUserId: string) {
  return {
    id: u.userId,
    auth_user_id: authUserId,
    handle: u.handle,
    display_name: u.displayName,
    class_name: u.className,
    tone: u.tone,
    total_xp: u.totalXp,
    streak_days: u.streakDays,
    streak_freezes: u.streakFreezes,
    last_active_date: u.lastActiveDate ?? null,
    is_public: u.isPublic,
    daily_bonus_date: u.dailyBonusDate ?? null,
    daily_bonus_xp: u.dailyBonusXp ?? null,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
    deleted_at: (u as any).deletedAt ?? null,
  };
}

function mapHabitFromRow(r: any): Habit {
  return {
    id: r.id,
    userId: r.user_id,
    goalId: r.goal_id ?? undefined,
    title: r.title,
    color: r.color ?? undefined,
    kind: r.kind,
    unit: r.unit ?? undefined,
    target: r.target,
    targetMode: r.target_mode,
    steps: r.steps ?? undefined,
    cadence: r.cadence,
    customDays: r.custom_days ?? undefined,
    cue: r.cue ?? undefined,
    scheduledTime: r.scheduled_time ?? undefined,
    difficulty: r.difficulty ?? 2,
    weeklyTarget: r.weekly_target ?? undefined,
    area: r.area ?? undefined,
    archived: r.archived ?? 0,
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
    deletedAt: r.deleted_at ?? undefined,
  } as Habit;
}

function mapHabitToRow(h: Habit) {
  return {
    id: h.id,
    user_id: h.userId,
    goal_id: h.goalId ?? null,
    title: h.title,
    color: h.color ?? null,
    kind: h.kind,
    unit: h.unit ?? null,
    target: h.target,
    target_mode: h.targetMode,
    steps: h.steps ?? null,
    cadence: h.cadence,
    custom_days: h.customDays ?? null,
    cue: h.cue ?? null,
    scheduled_time: h.scheduledTime ?? null,
    difficulty: h.difficulty ?? 2,
    weekly_target: h.weeklyTarget ?? null,
    area: h.area ?? null,
    archived: h.archived ?? 0,
    created_at: h.createdAt,
    updated_at: h.updatedAt,
    deleted_at: h.deletedAt ?? null,
  };
}

function mapLogFromRow(r: any): Log {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    goalId: r.goal_id ?? undefined,
    date: r.date,
    value: r.value,
    steps: r.steps ?? undefined,
    notes: r.notes ?? undefined,
    xpAwarded: r.xp_awarded ?? undefined,
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
    deletedAt: r.deleted_at ?? undefined,
  } as Log;
}

function mapLogToRow(l: Log) {
  return {
    id: l.id,
    user_id: l.userId,
    habit_id: l.habitId,
    goal_id: l.goalId ?? null,
    date: l.date,
    value: l.value ?? 1,
    steps: l.steps ?? null,
    notes: l.notes ?? null,
    xp_awarded: l.xpAwarded ?? null,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
    deleted_at: l.deletedAt ?? null,
  };
}

function mapSessionFromRow(r: any): Session {
  return {
    id: r.id,
    userId: r.user_id,
    goalId: r.goal_id ?? undefined,
    minutes: r.minutes,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    notes: r.notes ?? undefined,
    xpAwarded: r.xp_awarded ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? undefined,
  } as Session;
}

function mapSessionToRow(s: Session) {
  return {
    id: s.id,
    user_id: s.userId,
    // Supabase schema still has sessions.goal_id -> goals.id (legacy).
    // Our app's focus sessions are attached to habits (goals==habits), so avoid FK violations.
    goal_id: null,
    minutes: s.minutes,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    notes: s.notes ?? null,
    xp_awarded: s.xpAwarded ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    deleted_at: s.deletedAt ?? null,
  };
}

function mapReminderFromRow(r: any): Reminder {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    time: r.time,
    tone: r.tone,
    enabled: r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  } as Reminder;
}

function mapReminderToRow(r: Reminder) {
  return {
    id: r.id,
    user_id: r.userId,
    habit_id: r.habitId,
    time: r.time,
    tone: r.tone,
    enabled: r.enabled,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export class CloudRepository implements Repository {
  private local = new DexieRepository();

  async getUser(): Promise<UserProfile | undefined> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.getUser();

    const { data: auth } = await sb.auth.getUser();
    const authUserId = auth.user?.id;
    if (!authUserId) return undefined;

    const { data, error } = await sb
      .from("user_profile")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error || !data) return this.local.getUser();

    const u = mapUserFromRow(data);
    await this.local.upsertUser(u);
    return u;
  }

  async upsertUser(user: UserProfile): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) {
      const { data: auth } = await sb.auth.getUser();
      const authUserId = auth.user?.id;
      if (authUserId) {
        const { data: existing } = await sb
          .from("user_profile")
          .select("*")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        // Do not let stale local state overwrite newer cloud rows, but allow
        // intentional newer updates to decrease XP (undo/reset/daily bonus removal).
        if (existing?.updated_at && existing.updated_at > (user.updatedAt ?? 0)) {
          const fresh = mapUserFromRow(existing);
          await this.local.upsertUser(fresh);
          return;
        }

        const safe: UserProfile = { ...user, createdAt: existing?.created_at ?? user.createdAt };

        await sb.from("user_profile").upsert(mapUserToRow(safe, authUserId));
        user = safe;
      }
    }
    await this.local.upsertUser(user);
  }

  // goals still local-only for now
  listGoals = this.local.listGoals.bind(this.local);
  getGoal = this.local.getGoal.bind(this.local);
  upsertGoal = this.local.upsertGoal.bind(this.local);
  deleteGoal = this.local.deleteGoal.bind(this.local);

  async listHabits(opts?: { goalId?: string; includeArchived?: boolean }): Promise<Habit[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listHabits(opts);
    const u = await this.getUser();
    if (!u) return [];

    const { data, error } = await sb.from("habits").select("*");
    if (!error && Array.isArray(data)) {
      const habits = data.map(mapHabitFromRow).filter((h) => h.userId === u.userId);
      for (const h of habits) {
        const local = await db().habits.get(h.id);
        if (isRemoteNewer(h, local)) await db().habits.put(h);
      }
      return habits
        .filter((h) => (opts?.goalId ? h.goalId === opts.goalId : true))
        .filter((h) => (opts?.includeArchived ? true : !h.archived && !h.deletedAt));
    }
    return this.local.listHabits(opts);
  }

  async getHabit(id: string): Promise<Habit | undefined> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.getHabit(id);
    const { data } = await sb.from("habits").select("*").eq("id", id).maybeSingle();
    if (data) {
      const h = mapHabitFromRow(data);
      await this.local.upsertHabit(h);
      return h;
    }
    return this.local.getHabit(id);
  }

  async upsertHabit(habit: Habit): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("habits").upsert(mapHabitToRow(habit));
    await this.local.upsertHabit(habit);
  }

  async deleteHabit(id: string): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("habits").delete().eq("id", id);
    await this.local.deleteHabit(id);
  }

  async listLogs(opts?: { from?: string; to?: string; habitId?: string }): Promise<Log[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listLogs(opts);
    const u = await this.getUser();
    if (!u) return [];

    let q: any = sb.from("logs").select("*");
    if (opts?.from) q = q.gte("date", opts.from);
    if (opts?.to) q = q.lte("date", opts.to);
    if (opts?.habitId) q = q.eq("habit_id", opts.habitId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      const logs = data.map(mapLogFromRow).filter((l) => l.userId === u.userId);
      for (const l of logs) {
        const local = await db().logs.get(l.id);
        if (isRemoteNewer(l, local)) await db().logs.put(l);
      }
      return logs.filter((l) => !l.deletedAt);
    }
    return this.local.listLogs(opts);
  }

  async upsertLog(log: Log): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) {
      // Ensure the referenced habit exists in cloud first (Supabase FK: logs.habit_id -> habits.id).
      // If the habit was just created locally, log upsert can race and fail.
      const { data: existingHabit } = await sb
        .from("habits")
        .select("id")
        .eq("id", log.habitId)
        .maybeSingle();
      if (!existingHabit) {
        const h = await this.local.getHabit(log.habitId);
        if (h) await sb.from("habits").upsert(mapHabitToRow(h));
      }
      await sb.from("logs").upsert(mapLogToRow(log));
    }
    await this.local.upsertLog(log);
  }

  async deleteLog(id: string): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("logs").delete().eq("id", id);
    await this.local.deleteLog(id);
  }

  async listSessions(opts?: { goalId?: string; from?: number; to?: number }): Promise<Session[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listSessions(opts);
    const u = await this.getUser();
    if (!u) return [];

    let q: any = sb.from("sessions").select("*");
    if (opts?.goalId) q = q.eq("goal_id", opts.goalId);
    if (opts?.from) q = q.gte("started_at", opts.from);
    if (opts?.to) q = q.lt("started_at", opts.to);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      const sessions = data.map(mapSessionFromRow).filter((s) => s.userId === u.userId);
      for (const s of sessions) {
        const local = await db().sessions.get(s.id);
        if (isRemoteNewer(s, local)) await db().sessions.put(s);
      }
      return sessions.filter((s) => !s.deletedAt);
    }
    return this.local.listSessions(opts);
  }

  async upsertSession(s: Session): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("sessions").upsert(mapSessionToRow(s));
    await this.local.upsertSession(s);
  }

  async deleteSession(id: string): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("sessions").delete().eq("id", id);
    await this.local.deleteSession(id);
  }

  async listAchievements() { return this.local.listAchievements(); }
  async upsertAchievement(a: any) { return this.local.upsertAchievement(a); }

  async listReminders(): Promise<Reminder[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listReminders();
    const u = await this.getUser();
    if (!u) return [];
    const { data, error } = await sb.from("reminders").select("*");
    if (!error && Array.isArray(data)) {
      const rems = data.map(mapReminderFromRow).filter((r) => r.userId === u.userId);
      for (const r of rems) {
        const local = await db().reminders.get(r.id);
        if (isRemoteNewer(r, local)) await db().reminders.put(r);
      }
      return rems;
    }
    return this.local.listReminders();
  }

  async upsertReminder(r: Reminder): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("reminders").upsert(mapReminderToRow(r));
    await this.local.upsertReminder(r);
  }

  async deleteReminder(id: string): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) await sb.from("reminders").delete().eq("id", id);
    await this.local.deleteReminder(id);
  }

  // passthrough for remaining methods (still local-only)
  listTrackers = this.local.listTrackers.bind(this.local);
  upsertTracker = this.local.upsertTracker.bind(this.local);
  deleteTracker = this.local.deleteTracker.bind(this.local);
  listTrackerEntries = this.local.listTrackerEntries.bind(this.local);
  upsertTrackerEntry = this.local.upsertTrackerEntry.bind(this.local);
  deleteTrackerEntry = this.local.deleteTrackerEntry.bind(this.local);
  listFriendships = this.local.listFriendships.bind(this.local);
  upsertFriendship = this.local.upsertFriendship.bind(this.local);
  listSquads = this.local.listSquads.bind(this.local);
  upsertSquad = this.local.upsertSquad.bind(this.local);
  listSquadMembers = this.local.listSquadMembers.bind(this.local);
  upsertSquadMember = this.local.upsertSquadMember.bind(this.local);
  listStakes = this.local.listStakes.bind(this.local);
  upsertStake = this.local.upsertStake.bind(this.local);
  listDuels = this.local.listDuels.bind(this.local);
  upsertDuel = this.local.upsertDuel.bind(this.local);
  listFeed = this.local.listFeed.bind(this.local);
  pushFeed = this.local.pushFeed.bind(this.local);
  listNudges = this.local.listNudges.bind(this.local);
  pushNudge = this.local.pushNudge.bind(this.local);

  exportAll = this.local.exportAll.bind(this.local);
  importAll = this.local.importAll.bind(this.local);

  async clearAll(): Promise<void> {
    const sb = supabaseBrowser();
    if (sb) {
      const u = await this.getUser();
      if (u) {
        const userId = u.userId;
        // Delete children before parents to satisfy FK constraints.
        await sb.from("logs").delete().eq("user_id", userId);
        await sb.from("sessions").delete().eq("user_id", userId);
        await sb.from("reminders").delete().eq("user_id", userId);
        await sb.from("tracker_entries").delete().eq("user_id", userId);
        await sb.from("trackers").delete().eq("user_id", userId);
        await sb.from("achievements").delete().eq("user_id", userId);
        await sb.from("habits").delete().eq("user_id", userId);
        await sb.from("goals").delete().eq("user_id", userId);
      }
    }
    await this.local.clearAll();
  }
}

