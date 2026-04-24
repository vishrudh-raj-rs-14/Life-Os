import Dexie, { type Table } from "dexie";
import type {
  Achievement,
  AccountabilityStake,
  BodyLog,
  Duel,
  FeedEvent,
  Friendship,
  Goal,
  GoalEntry,
  Habit,
  Log,
  Nudge,
  Reminder,
  Session,
  Squad,
  SquadMember,
  SyncQueueItem,
  Tracker,
  TrackerEntry,
  UserProfile,
  VoiceNote,
} from "@/types";

export class HabitDB extends Dexie {
  goals!: Table<Goal, string>;
  habits!: Table<Habit, string>;
  logs!: Table<Log, string>;
  sessions!: Table<Session, string>;
  user!: Table<UserProfile, string>;
  achievements!: Table<Achievement, string>;
  reminders!: Table<Reminder, string>;
  // social
  friendships!: Table<Friendship, string>;
  squads!: Table<Squad, string>;
  squadMembers!: Table<SquadMember, string>;
  stakes!: Table<AccountabilityStake, string>;
  duels!: Table<Duel, string>;
  feed!: Table<FeedEvent, string>;
  nudges!: Table<Nudge, string>;
  // trackers
  trackers!: Table<Tracker, string>;
  trackerEntries!: Table<TrackerEntry, string>;
  // voice notes
  voiceNotes!: Table<VoiceNote, string>;
  // goal journal entries
  goalEntries!: Table<GoalEntry, string>;
  // body logs (daily weight + progress photo)
  bodyLogs!: Table<BodyLog, string>;
  // sync
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("habit-tracker");

    // v1 — baseline schema
    this.version(1).stores({
      goals: "id, userId, category, archived, updatedAt",
      habits: "id, userId, goalId, cadence, archived, updatedAt",
      logs: "id, userId, habitId, goalId, date, [habitId+date], updatedAt",
      sessions: "id, userId, goalId, startedAt, endedAt, updatedAt",
      user: "userId, handle, updatedAt",
      achievements: "id, userId, key, unlockedAt",
      reminders: "id, userId, habitId, time",
      friendships: "id, fromUserId, toUserId, status",
      squads: "id, ownerId, inviteCode",
      squadMembers: "id, squadId, userId",
      stakes: "id, userId, goalId, partnerUserId",
      duels: "id, challengerId, challengeeId, squadId, endsAt",
      feed: "id, userId, type, createdAt",
      nudges: "id, fromUserId, toUserId, createdAt",
      syncQueue: "id, table, recordId, enqueuedAt",
    });

    // v2 — habit kinds (binary/count/duration/checklist), goal pipeline, trackers
    this.version(2)
      .stores({
        habits: "id, userId, goalId, cadence, kind, archived, updatedAt",
        trackers: "id, userId, goalId, kind, archived, updatedAt",
        trackerEntries: "id, userId, trackerId, date, [trackerId+date], updatedAt",
      })
      .upgrade(async (tx) => {
        const habits = await tx.table("habits").toArray();
        for (const h of habits) {
          await tx.table("habits").update(h.id, {
            kind: h.kind ?? "binary",
            target: h.target ?? h.targetCount ?? 1,
            targetMode: h.targetMode ?? "at-least",
            unit: h.unit,
          });
        }
        const logs = await tx.table("logs").toArray();
        for (const l of logs) {
          if (l.value == null) {
            await tx.table("logs").update(l.id, { value: l.count ?? 1 });
          }
        }
      });

    // v3 — voice notes
    this.version(3).stores({
      voiceNotes: "id, userId, date, createdAt",
    });

    // v4 — goal journal entries
    this.version(4).stores({
      goalEntries: "id, userId, habitId, date, createdAt",
    });

    // v5 — body logs (daily weight + progress photo)
    this.version(5).stores({
      bodyLogs: "id, userId, date, createdAt",
    });
  }
}

let _db: HabitDB | null = null;

export function db(): HabitDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie can only be used on the client");
  }
  if (!_db) _db = new HabitDB();
  return _db;
}
