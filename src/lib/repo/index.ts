import type {
  Achievement,
  AccountabilityStake,
  Duel,
  FeedEvent,
  Friendship,
  Goal,
  Habit,
  Log,
  Nudge,
  Reminder,
  Session,
  Squad,
  SquadMember,
  Tracker,
  TrackerEntry,
  UserProfile,
} from "@/types";

export interface Repository {
  // user
  getUser(): Promise<UserProfile | undefined>;
  upsertUser(user: UserProfile): Promise<void>;

  // goals
  listGoals(opts?: { includeArchived?: boolean }): Promise<Goal[]>;
  getGoal(id: string): Promise<Goal | undefined>;
  upsertGoal(goal: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  // habits
  listHabits(opts?: { goalId?: string; includeArchived?: boolean }): Promise<Habit[]>;
  getHabit(id: string): Promise<Habit | undefined>;
  upsertHabit(habit: Habit): Promise<void>;
  deleteHabit(id: string): Promise<void>;

  // logs
  listLogs(opts?: { from?: string; to?: string; habitId?: string }): Promise<Log[]>;
  upsertLog(log: Log): Promise<void>;
  deleteLog(id: string): Promise<void>;

  // sessions
  listSessions(opts?: { goalId?: string; from?: number; to?: number }): Promise<Session[]>;
  upsertSession(s: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // achievements
  listAchievements(): Promise<Achievement[]>;
  upsertAchievement(a: Achievement): Promise<void>;

  // reminders
  listReminders(): Promise<Reminder[]>;
  upsertReminder(r: Reminder): Promise<void>;
  deleteReminder(id: string): Promise<void>;

  // trackers
  listTrackers(opts?: { goalId?: string }): Promise<Tracker[]>;
  upsertTracker(t: Tracker): Promise<void>;
  deleteTracker(id: string): Promise<void>;
  listTrackerEntries(opts?: { trackerId?: string }): Promise<TrackerEntry[]>;
  upsertTrackerEntry(e: TrackerEntry): Promise<void>;
  deleteTrackerEntry(id: string): Promise<void>;

  // social (cloud-only operations are no-ops in local impl)
  listFriendships(): Promise<Friendship[]>;
  upsertFriendship(f: Friendship): Promise<void>;
  listSquads(): Promise<Squad[]>;
  upsertSquad(s: Squad): Promise<void>;
  listSquadMembers(squadId?: string): Promise<SquadMember[]>;
  upsertSquadMember(m: SquadMember): Promise<void>;
  listStakes(): Promise<AccountabilityStake[]>;
  upsertStake(s: AccountabilityStake): Promise<void>;
  listDuels(): Promise<Duel[]>;
  upsertDuel(d: Duel): Promise<void>;
  listFeed(opts?: { limit?: number }): Promise<FeedEvent[]>;
  pushFeed(e: FeedEvent): Promise<void>;
  listNudges(): Promise<Nudge[]>;
  pushNudge(n: Nudge): Promise<void>;

  // utility
  exportAll(): Promise<Record<string, unknown[]>>;
  importAll(data: Record<string, unknown[]>): Promise<void>;
  clearAll(): Promise<void>;
}

let _repo: Repository | null = null;

export async function getRepo(): Promise<Repository> {
  if (_repo) return _repo;
  // Cloud-first: Supabase source-of-truth with Dexie cache fallback.
  const { CloudRepository } = await import("./cloud");
  _repo = new CloudRepository();
  return _repo;
}
