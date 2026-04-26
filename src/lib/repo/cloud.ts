"use client";

import type {
  AdherenceProfile,
  BodyLog,
  GoalEntry,
  Habit,
  HabitRamp,
  Log,
  Reminder,
  Session,
  UserProfile,
  VoiceNote,
} from "@/types";
import type { Repository } from "./index";
import { DexieRepository } from "./dexie";
import { supabaseBrowser } from "@/lib/supabase/client";
import { db } from "@/lib/db/dexie";
import { ensureAuthUser, getCachedAuthUser } from "@/lib/auth";
import { enqueueWrite } from "@/lib/sync/writeQueue";
import { r2DeleteKey, r2UploadBlob, r2WipeUserPrefix } from "@/lib/media/r2Client";

// Cloud-first for core tables (user, habits, logs, sessions, reminders).
// Dexie remains the offline cache fallback.

// ─── Mappers: local (camelCase) <-> Supabase (snake_case) ────────────────────

function isRemoteNewer<T extends { updatedAt?: number }>(remote: T, local?: T) {
  return !local || (local.updatedAt ?? 0) <= (remote.updatedAt ?? 0);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function throwIfError(result: { error: unknown }) {
  if (result.error) throw result.error;
}

function withoutLevel(row: ReturnType<typeof mapUserToRow>) {
  const { level: _level, ...rest } = row;
  return rest;
}

function isMissingLevelError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    String((error as { message?: unknown }).message).includes("'level' column")
  );
}

function parseAdherenceJson(raw: unknown): AdherenceProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as AdherenceProfile;
}

function parseRampJson(raw: unknown): HabitRamp | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as HabitRamp;
    } catch {
      return undefined;
    }
  }
  return raw as HabitRamp;
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
    adherence: parseAdherenceJson(r.adherence_json),
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
    level: u.level,
    tone: u.tone,
    total_xp: u.totalXp,
    streak_days: u.streakDays,
    streak_freezes: u.streakFreezes,
    last_active_date: u.lastActiveDate ?? null,
    is_public: u.isPublic,
    daily_bonus_date: u.dailyBonusDate ?? null,
    daily_bonus_xp: u.dailyBonusXp ?? null,
    adherence_json: u.adherence ?? null,
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
    ramp: parseRampJson(r.ramp_json),
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
    ramp_json: h.ramp ?? null,
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
    xpAwarded: r.xp_awarded ?? 0,
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
    xp_awarded: l.xpAwarded ?? 0,
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
    goal_id: s.goalId ?? null,
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
    deletedAt: r.deleted_at ?? undefined,
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
    deleted_at: r.deletedAt ?? null,
  };
}

function mapBodyLogFromRow(r: any): BodyLog {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    weight: r.weight ?? undefined,
    notes: r.notes ?? undefined,
    photoStorageKey: r.photo_storage_key ?? undefined,
    mimeType: r.photo_mime_type ?? undefined,
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
  };
}

function mapBodyLogToRow(b: BodyLog) {
  return {
    id: b.id,
    user_id: b.userId,
    date: b.date,
    weight: b.weight ?? null,
    notes: b.notes ?? null,
    photo_storage_key: b.photoStorageKey ?? null,
    photo_mime_type: b.mimeType ?? null,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}

function mapVoiceNoteFromRow(r: any): VoiceNote {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title ?? undefined,
    duration: r.duration_seconds ?? 0,
    date: r.date,
    audioStorageKey: r.audio_storage_key ?? undefined,
    mimeType: r.audio_mime_type ?? undefined,
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
    deletedAt: r.deleted_at ?? undefined,
  };
}

function mapVoiceNoteToRow(v: VoiceNote) {
  return {
    id: v.id,
    user_id: v.userId,
    title: v.title ?? null,
    duration_seconds: v.duration,
    date: v.date,
    audio_storage_key: v.audioStorageKey!,
    audio_mime_type: v.mimeType ?? null,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
    deleted_at: v.deletedAt ?? null,
  };
}

function mapGoalEntryFromRow(r: any): GoalEntry {
  return {
    id: r.id,
    userId: r.user_id,
    habitId: r.habit_id,
    date: r.date,
    text: r.note_text ?? undefined,
    photoStorageKey: r.photo_storage_key ?? undefined,
    mimeType: r.photo_mime_type ?? undefined,
    createdAt: r.created_at ?? Date.now(),
    updatedAt: r.updated_at ?? Date.now(),
    deletedAt: r.deleted_at ?? undefined,
  };
}

function mapGoalEntryToRow(e: GoalEntry) {
  return {
    id: e.id,
    user_id: e.userId,
    habit_id: e.habitId,
    date: e.date,
    note_text: e.text ?? null,
    photo_storage_key: e.photoStorageKey ?? null,
    photo_mime_type: e.mimeType ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    deleted_at: e.deletedAt ?? null,
  };
}

export class CloudRepository implements Repository {
  private local = new DexieRepository();

  private async authUserId() {
    return getCachedAuthUser()?.id ?? (await ensureAuthUser())?.id;
  }

  private async currentUserId() {
    const authUserId = await this.authUserId();
    if (authUserId) return authUserId;
    return (await this.local.getUser())?.userId;
  }

  async getUser(): Promise<UserProfile | undefined> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.getUser();

    const authUserId = await this.authUserId();
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
    await this.local.upsertUser(user);
    if (sb && isUuid(user.userId)) {
      const authUserId = user.userId;
      await enqueueWrite(async () => {
        const { data: existing } = await sb
          .from("user_profile")
          .select("*")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        const safe: UserProfile = { ...user, createdAt: existing?.created_at ?? user.createdAt };
        const row = mapUserToRow(safe, authUserId);
        const { error } = await sb.from("user_profile").upsert(row);
        if (error) {
          if (isMissingLevelError(error)) {
            const retry = await sb.from("user_profile").upsert(withoutLevel(row));
            if (retry.error) throw retry.error;
            return;
          }
          throw error;
        }
      });
    }
  }

  // goals still local-only for now
  listGoals = this.local.listGoals.bind(this.local);
  getGoal = this.local.getGoal.bind(this.local);
  upsertGoal = this.local.upsertGoal.bind(this.local);
  deleteGoal = this.local.deleteGoal.bind(this.local);

  async listHabits(opts?: { goalId?: string; includeArchived?: boolean }): Promise<Habit[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listHabits(opts);
    const userId = await this.currentUserId();
    if (!userId) return [];

    const { data, error } = await sb.from("habits").select("*");
    if (!error && Array.isArray(data)) {
      const habits = data.map(mapHabitFromRow).filter((h) => h.userId === userId);
      for (const h of habits) {
        const local = await db().habits.get(h.id);
        if (isRemoteNewer(h, local)) await db().habits.put(h);
      }
      void import("@/store/useUser").then(({ useUser }) => {
        const u = useUser.getState().user;
        if (!u) return;
        void useUser.getState().setUser({
          ...u,
          adherence: { ...u.adherence, lastCloudSyncAt: Date.now() },
          updatedAt: Date.now(),
        });
      });
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
    await this.local.upsertHabit(habit);
    if (sb) await enqueueWrite(() => sb.from("habits").upsert(mapHabitToRow(habit)).then(throwIfError));
  }

  async deleteHabit(id: string): Promise<void> {
    const sb = supabaseBrowser();
    await this.local.deleteHabit(id);
    if (sb) await enqueueWrite(() => sb.from("habits").delete().eq("id", id).then(throwIfError));
  }

  async listLogs(opts?: { from?: string; to?: string; habitId?: string }): Promise<Log[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listLogs(opts);
    const userId = await this.currentUserId();
    if (!userId) return [];

    let q: any = sb.from("logs").select("*");
    if (opts?.from) q = q.gte("date", opts.from);
    if (opts?.to) q = q.lte("date", opts.to);
    if (opts?.habitId) q = q.eq("habit_id", opts.habitId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      const logs = data.map(mapLogFromRow).filter((l) => l.userId === userId);
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
    await this.local.upsertLog(log);
    if (sb) {
      await enqueueWrite(async () => {
        const { data: existingHabit } = await sb
          .from("habits")
          .select("id")
          .eq("id", log.habitId)
          .maybeSingle();
        if (!existingHabit) {
          const h = await this.local.getHabit(log.habitId);
          if (h) {
            const { error } = await sb.from("habits").upsert(mapHabitToRow(h));
            if (error) throw error;
          }
        }
        const { error } = await sb.from("logs").upsert(mapLogToRow(log));
        if (error) throw error;
      });
    }
  }

  async deleteLog(id: string): Promise<void> {
    const sb = supabaseBrowser();
    await this.local.deleteLog(id);
    if (sb) await enqueueWrite(() => sb.from("logs").delete().eq("id", id).then(throwIfError));
  }

  async listSessions(opts?: { goalId?: string; from?: number; to?: number }): Promise<Session[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listSessions(opts);
    const userId = await this.currentUserId();
    if (!userId) return [];

    let q: any = sb.from("sessions").select("*");
    if (opts?.goalId) q = q.eq("goal_id", opts.goalId);
    if (opts?.from) q = q.gte("started_at", opts.from);
    if (opts?.to) q = q.lt("started_at", opts.to);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      const sessions = data.map(mapSessionFromRow).filter((s) => s.userId === userId);
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
    await this.local.upsertSession(s);
    if (sb) await enqueueWrite(() => sb.from("sessions").upsert(mapSessionToRow(s)).then(throwIfError));
  }

  async deleteSession(id: string): Promise<void> {
    const sb = supabaseBrowser();
    await this.local.deleteSession(id);
    if (sb) await enqueueWrite(() => sb.from("sessions").delete().eq("id", id).then(throwIfError));
  }

  async listAchievements() { return this.local.listAchievements(); }
  async upsertAchievement(a: any) { return this.local.upsertAchievement(a); }

  async listReminders(): Promise<Reminder[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listReminders();
    const userId = await this.currentUserId();
    if (!userId) return [];
    const { data, error } = await sb.from("reminders").select("*");
    if (!error && Array.isArray(data)) {
      const rems = data.map(mapReminderFromRow).filter((r) => r.userId === userId);
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
    await this.local.upsertReminder(r);
    if (sb) await enqueueWrite(() => sb.from("reminders").upsert(mapReminderToRow(r)).then(throwIfError));
  }

  async deleteReminder(id: string): Promise<void> {
    const sb = supabaseBrowser();
    await this.local.deleteReminder(id);
    if (sb) await enqueueWrite(() => sb.from("reminders").delete().eq("id", id).then(throwIfError));
  }

  async listBodyLogs(): Promise<BodyLog[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listBodyLogs();
    const userId = await this.currentUserId();
    if (!userId) return [];
    const { data, error } = await sb.from("body_logs").select("*").eq("user_id", userId);
    if (!error && Array.isArray(data)) {
      const rows = data.map(mapBodyLogFromRow).filter((b) => b.userId === userId);
      for (const b of rows) {
        const local = await db().bodyLogs.get(b.id);
        if (isRemoteNewer(b, local)) await db().bodyLogs.put(b);
      }
      const localLogs = await this.local.listBodyLogs();
      return localLogs.filter((b) => b.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
    }
    const fb = await this.local.listBodyLogs();
    const uid = await this.currentUserId();
    return uid ? fb.filter((b) => b.userId === uid) : fb;
  }

  async upsertBodyLog(log: BodyLog): Promise<void> {
    const sb = supabaseBrowser();
    let merged: BodyLog = { ...log };
    await this.local.upsertBodyLog(log);
    if (!sb) return;
    if (log.blob) {
      try {
        const key = await r2UploadBlob("body", log.id, log.blob);
        merged = {
          ...merged,
          photoStorageKey: key,
          mimeType: log.mimeType ?? log.blob.type ?? undefined,
        };
        await this.local.upsertBodyLog(merged);
      } catch {
        /* R2 not configured or upload failed — still sync weight/notes */
      }
    }
    await enqueueWrite(() =>
      sb
        .from("body_logs")
        .upsert(mapBodyLogToRow(merged), { onConflict: "user_id,date" })
        .then(throwIfError)
    );
  }

  async deleteBodyLog(id: string): Promise<void> {
    const existing = await db().bodyLogs.get(id);
    const sb = supabaseBrowser();
    await this.local.deleteBodyLog(id);
    if (existing?.photoStorageKey) {
      try {
        await r2DeleteKey(existing.photoStorageKey);
      } catch {
        /* ignore */
      }
    }
    if (sb) await enqueueWrite(() => sb.from("body_logs").delete().eq("id", id).then(throwIfError));
  }

  async listVoiceNotes(): Promise<VoiceNote[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listVoiceNotes();
    const userId = await this.currentUserId();
    if (!userId) return [];
    const { data, error } = await sb.from("voice_notes").select("*").eq("user_id", userId);
    if (!error && Array.isArray(data)) {
      const rows = data.map(mapVoiceNoteFromRow).filter((v) => v.userId === userId && !v.deletedAt);
      for (const v of rows) {
        const local = await db().voiceNotes.get(v.id);
        if (isRemoteNewer(v, local)) await db().voiceNotes.put({ ...v, blob: local?.blob });
      }
      const localNotes = await this.local.listVoiceNotes();
      return localNotes.filter((n) => n.userId === userId);
    }
    const fallback = await this.local.listVoiceNotes();
    const uid = await this.currentUserId();
    return uid ? fallback.filter((n) => n.userId === uid) : fallback;
  }

  async upsertVoiceNote(note: VoiceNote): Promise<void> {
    const sb = supabaseBrowser();
    await this.local.upsertVoiceNote(note);
    if (!sb) return;
    let merged: VoiceNote = { ...note };
    if (note.blob) {
      try {
        const key = await r2UploadBlob("voice", note.id, note.blob);
        merged = {
          ...merged,
          audioStorageKey: key,
          mimeType: (note.mimeType ?? note.blob.type) || "audio/webm",
        };
        await this.local.upsertVoiceNote(merged);
      } catch {
        return;
      }
    }
    if (!merged.audioStorageKey) return;
    await enqueueWrite(() =>
      sb.from("voice_notes").upsert(mapVoiceNoteToRow(merged)).then(throwIfError)
    );
  }

  async deleteVoiceNote(id: string): Promise<void> {
    const existing = await db().voiceNotes.get(id);
    const sb = supabaseBrowser();
    await this.local.deleteVoiceNote(id);
    if (existing?.audioStorageKey) {
      try {
        await r2DeleteKey(existing.audioStorageKey);
      } catch {
        /* ignore */
      }
    }
    if (sb) await enqueueWrite(() => sb.from("voice_notes").delete().eq("id", id).then(throwIfError));
  }

  async listGoalEntries(opts?: { habitId?: string }): Promise<GoalEntry[]> {
    const sb = supabaseBrowser();
    if (!sb) return this.local.listGoalEntries(opts);
    const userId = await this.currentUserId();
    if (!userId) return [];
    let q: any = sb.from("goal_entries").select("*").eq("user_id", userId);
    if (opts?.habitId) q = q.eq("habit_id", opts.habitId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      const rows = data.map(mapGoalEntryFromRow).filter((e) => e.userId === userId && !e.deletedAt);
      for (const e of rows) {
        const local = await db().goalEntries.get(e.id);
        if (isRemoteNewer(e, local)) await db().goalEntries.put({ ...e, blob: local?.blob });
      }
      const localE = await this.local.listGoalEntries(opts);
      return localE.filter((e) => e.userId === userId);
    }
    const fb = await this.local.listGoalEntries(opts);
    const uid = await this.currentUserId();
    return uid ? fb.filter((e) => e.userId === uid) : fb;
  }

  async upsertGoalEntry(entry: GoalEntry): Promise<void> {
    const sb = supabaseBrowser();
    let merged: GoalEntry = { ...entry };
    await this.local.upsertGoalEntry(entry);
    if (!sb) return;
    if (entry.blob) {
      try {
        const key = await r2UploadBlob("goal", entry.id, entry.blob);
        merged = {
          ...merged,
          photoStorageKey: key,
          mimeType: entry.mimeType ?? entry.blob.type ?? undefined,
        };
        await this.local.upsertGoalEntry(merged);
      } catch {
        /* photo stays local only */
      }
    }
    await enqueueWrite(() =>
      sb.from("goal_entries").upsert(mapGoalEntryToRow(merged)).then(throwIfError)
    );
  }

  async deleteGoalEntry(id: string): Promise<void> {
    const existing = await db().goalEntries.get(id);
    const sb = supabaseBrowser();
    await this.local.deleteGoalEntry(id);
    if (existing?.photoStorageKey) {
      try {
        await r2DeleteKey(existing.photoStorageKey);
      } catch {
        /* ignore */
      }
    }
    if (sb) await enqueueWrite(() => sb.from("goal_entries").delete().eq("id", id).then(throwIfError));
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
        await sb.from("body_logs").delete().eq("user_id", userId);
        await sb.from("voice_notes").delete().eq("user_id", userId);
        await sb.from("goal_entries").delete().eq("user_id", userId);
        await sb.from("achievements").delete().eq("user_id", userId);
        await sb.from("habits").delete().eq("user_id", userId);
        await sb.from("goals").delete().eq("user_id", userId);
        try {
          await r2WipeUserPrefix();
        } catch {
          /* R2 optional */
        }
      }
    }
    await this.local.clearAll();
  }
}

