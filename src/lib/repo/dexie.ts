import { db } from "@/lib/db/dexie";
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
import type { Repository } from "./index";

const now = () => Date.now();
const stamp = <T extends { createdAt?: number; updatedAt?: number }>(o: T) => {
  const t = now();
  return { ...o, createdAt: o.createdAt ?? t, updatedAt: t } as T;
};

export class DexieRepository implements Repository {
  // user
  async getUser() {
    const all = await db().user.toArray();
    return all[0];
  }
  async upsertUser(user: UserProfile) {
    await db().user.put(stamp(user));
  }

  // goals
  async listGoals(opts?: { includeArchived?: boolean }) {
    const all = await db().goals.toArray();
    return all.filter((g) =>
      opts?.includeArchived ? true : !g.archived && !g.deletedAt
    );
  }
  async getGoal(id: string) {
    return db().goals.get(id);
  }
  async upsertGoal(goal: Goal) {
    await db().goals.put(stamp(goal));
  }
  async deleteGoal(id: string) {
    await db().goals.delete(id);
  }

  // habits
  async listHabits(opts?: { goalId?: string; includeArchived?: boolean }) {
    const all = await db().habits.toArray();
    return all.filter(
      (h) =>
        (opts?.includeArchived ? true : !h.archived && !h.deletedAt) &&
        (opts?.goalId ? h.goalId === opts.goalId : true)
    );
  }
  async getHabit(id: string) {
    return db().habits.get(id);
  }
  async upsertHabit(habit: Habit) {
    await db().habits.put(stamp(habit));
  }
  async deleteHabit(id: string) {
    await db().habits.delete(id);
  }

  // logs
  async listLogs(opts?: { from?: string; to?: string; habitId?: string }) {
    const all = await db().logs.toArray();
    return all.filter(
      (l) =>
        (!opts?.from || l.date >= opts.from) &&
        (!opts?.to || l.date <= opts.to) &&
        (!opts?.habitId || l.habitId === opts.habitId) &&
        !l.deletedAt
    );
  }
  async upsertLog(log: Log) {
    await db().logs.put(stamp(log));
  }
  async deleteLog(id: string) {
    await db().logs.delete(id);
  }

  // sessions
  async listSessions(opts?: { goalId?: string; from?: number; to?: number }) {
    const all = await db().sessions.toArray();
    return all.filter(
      (s) =>
        (!opts?.goalId || s.goalId === opts.goalId) &&
        (!opts?.from || s.startedAt >= opts.from) &&
        (!opts?.to || s.startedAt < opts.to) &&
        !s.deletedAt
    );
  }
  async upsertSession(s: Session) {
    await db().sessions.put(stamp(s));
  }
  async deleteSession(id: string) {
    await db().sessions.delete(id);
  }

  // achievements
  async listAchievements() {
    return db().achievements.toArray();
  }
  async upsertAchievement(a: Achievement) {
    await db().achievements.put(stamp(a));
  }

  // reminders
  async listReminders() {
    return db().reminders.toArray();
  }
  async upsertReminder(r: Reminder) {
    await db().reminders.put(stamp(r));
  }
  async deleteReminder(id: string) {
    await db().reminders.delete(id);
  }

  // trackers
  async listTrackers(opts?: { goalId?: string }) {
    const all = await db().trackers.toArray();
    return all.filter(
      (t) => (opts?.goalId ? t.goalId === opts.goalId : true) && !t.archived
    );
  }
  async upsertTracker(t: Tracker) {
    await db().trackers.put(stamp(t));
  }
  async deleteTracker(id: string) {
    await db().trackers.delete(id);
  }
  async listTrackerEntries(opts?: { trackerId?: string }) {
    const all = await db().trackerEntries.toArray();
    return all.filter(
      (e) =>
        (!opts?.trackerId || e.trackerId === opts.trackerId) && !e.deletedAt
    );
  }
  async upsertTrackerEntry(e: TrackerEntry) {
    await db().trackerEntries.put(stamp(e));
  }
  async deleteTrackerEntry(id: string) {
    await db().trackerEntries.delete(id);
  }

  // social
  async listFriendships() {
    return db().friendships.toArray();
  }
  async upsertFriendship(f: Friendship) {
    await db().friendships.put(stamp(f));
  }
  async listSquads() {
    return db().squads.toArray();
  }
  async upsertSquad(s: Squad) {
    await db().squads.put(stamp(s));
  }
  async listSquadMembers(squadId?: string) {
    const all = await db().squadMembers.toArray();
    return squadId ? all.filter((m) => m.squadId === squadId) : all;
  }
  async upsertSquadMember(m: SquadMember) {
    await db().squadMembers.put(m);
  }
  async listStakes() {
    return db().stakes.toArray();
  }
  async upsertStake(s: AccountabilityStake) {
    await db().stakes.put(stamp(s));
  }
  async listDuels() {
    return db().duels.toArray();
  }
  async upsertDuel(d: Duel) {
    await db().duels.put(stamp(d));
  }
  async listFeed(opts?: { limit?: number }) {
    const all = await db().feed.orderBy("createdAt").reverse().toArray();
    return opts?.limit ? all.slice(0, opts.limit) : all;
  }
  async pushFeed(e: FeedEvent) {
    await db().feed.put(e);
  }
  async listNudges() {
    return db().nudges.orderBy("createdAt").reverse().toArray();
  }
  async pushNudge(n: Nudge) {
    await db().nudges.put(n);
  }

  async exportAll() {
    const d = db();
    return {
      goals: await d.goals.toArray(),
      habits: await d.habits.toArray(),
      logs: await d.logs.toArray(),
      sessions: await d.sessions.toArray(),
      user: await d.user.toArray(),
      achievements: await d.achievements.toArray(),
      reminders: await d.reminders.toArray(),
      friendships: await d.friendships.toArray(),
      squads: await d.squads.toArray(),
      squadMembers: await d.squadMembers.toArray(),
      stakes: await d.stakes.toArray(),
      duels: await d.duels.toArray(),
      feed: await d.feed.toArray(),
      nudges: await d.nudges.toArray(),
    };
  }

  async importAll(data: Record<string, unknown[]>) {
    const d = db();
    if (data.goals) await d.goals.bulkPut(data.goals as Goal[]);
    if (data.habits) await d.habits.bulkPut(data.habits as Habit[]);
    if (data.logs) await d.logs.bulkPut(data.logs as Log[]);
    if (data.sessions) await d.sessions.bulkPut(data.sessions as Session[]);
    if (data.user) await d.user.bulkPut(data.user as UserProfile[]);
    if (data.achievements)
      await d.achievements.bulkPut(data.achievements as Achievement[]);
    if (data.reminders) await d.reminders.bulkPut(data.reminders as Reminder[]);
  }

  async clearAll() {
    const d = db();
    await Promise.all([
      d.goals.clear(),
      d.habits.clear(),
      d.logs.clear(),
      d.sessions.clear(),
      d.user.clear(),
      d.achievements.clear(),
      d.reminders.clear(),
      d.friendships.clear(),
      d.squads.clear(),
      d.squadMembers.clear(),
      d.stakes.clear(),
      d.duels.clear(),
      d.feed.clear(),
      d.nudges.clear(),
      d.trackers.clear(),
      d.trackerEntries.clear(),
      d.syncQueue.clear(),
    ]);
  }
}
