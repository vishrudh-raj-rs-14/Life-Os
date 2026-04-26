export type GoalCategory =
  | "code"
  | "learn"
  | "fitness"
  | "mind"
  | "wake"
  | "read"
  | "other";

export type ClassName = "engineer" | "athlete" | "scholar" | "polymath";

export type Tone = "coach" | "drill-sergeant" | "wise";

export type Cadence = "daily" | "alt-days" | "weekly" | "custom";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

// What the habit measures. Each kind has its own logging UI + chart.
//   binary    — done / not done
//   count     — quantity (pages read, problems solved, push-ups)
//   duration  — minutes (deep work, reading, meditation) — can be timer-driven
//   checklist — multi-step routine (morning routine, leg day)
export type HabitKind = "binary" | "count" | "duration" | "checklist";

// Whether the target is a floor or a ceiling.
//   at-least  — hit the number or beyond (default)
//   at-most   — stay under the number (screen time, sugar)
//   exactly   — hit it on the nose
export type TargetMode = "at-least" | "at-most" | "exactly";

// Categories used to drive smart suggestions in the goal pipeline.
export type LifeArea =
  | "career"
  | "health"
  | "mind"
  | "wealth"
  | "craft"
  | "relationships"
  | "lifestyle";

export interface Goal {
  id: string;
  userId: string;
  title: string;
  category: GoalCategory;
  area?: LifeArea;
  color: string;
  icon: string;
  weeklyTargetMinutes: number;
  dailyTargetMinutes?: number;
  // Life OS pipeline fields
  why?: string;
  outcome?: string; // success criterion in plain language
  metricLabel?: string; // e.g. "hours read", "kg lost"
  metricTarget?: number;
  reviewCadence?: "weekly" | "monthly";
  archived: 0 | 1;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/** Progressive target (e.g. wake time −15m/week). Updates `scheduledTime` when accepted. */
export interface HabitRamp {
  enabled: boolean;
  /** Final anchor time HH:mm */
  targetTime: string;
  /** Minutes earlier per step (default 15) */
  stepMinutes: number;
  mode: "weekly" | "after_streak";
  /** For `after_streak`: successes needed before next step */
  afterStreakDays?: number;
  lastAdjustedWeekKey?: string;
  /** Consecutive successful logs while at current window (for after_streak) */
  successStreakDays?: number;
}

export interface Habit {
  id: string;
  userId: string;
  goalId?: string; // legacy — ignored in flat model
  color?: string;  // accent colour shown in lists and cards
  title: string;
  kind: HabitKind;
  unit?: string; // for count / duration: "pages", "problems", "min"
  target: number; // generic target value (count, minutes, or 1 for binary)
  targetMode: TargetMode;
  steps?: string[]; // for checklist
  cadence: Cadence;
  customDays?: number[]; // 0=Sun..6=Sat
  cue?: string;
  scheduledTime?: string; // "HH:mm"
  difficulty: Difficulty;
  weeklyTarget?: number; // desired completions per week (overrides cadence-derived count in displays)
  area?: LifeArea;       // life area for grouping
  ramp?: HabitRamp;
  archived: 0 | 1;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/** Commitment, weekly check-in, schedule UX, optional accountability (synced via adherence_json). */
export interface AdherenceProfile {
  commitmentHabitIds?: string[];
  commitmentWhy?: string;
  commitmentRepair?: string;
  /** Set when user completes or skips the commitment step */
  commitmentCompletedAt?: number;
  commitmentSkipped?: boolean;
  /** ISO week key `yyyy-Www` of last submitted weekly review */
  weeklyReviewWeekKey?: string;
  weeklyReviewResponse?: "yes" | "partial" | "no";
  weeklyReviewNote?: string;
  /** ±minutes around scheduledTime for on-time XP bonus (default 45 in UI) */
  scheduleGraceMinutes?: number;
  /** Consecutive “perfect” ISO weeks (100% due habits each day) for earn-back freezes */
  perfectWeekStreak?: number;
  /** `perfect:${yyyy-MM-dd}` Monday of last scored prior week */
  lastPerfectWeekEvaluatedKey?: string;
  /** Partner / squad can see weekly scorecard (opt-in, honor-system UI) */
  showWeeklyScorecardToPartner?: boolean;
  /** Last time user exported JSON (ms) */
  lastDataExportAt?: number;
  /** Client-updated when a successful cloud list sync runs */
  lastCloudSyncAt?: number;
}

export interface Log {
  id: string;
  userId: string;
  habitId: string;
  goalId?: string;
  date: string; // YYYY-MM-DD
  // For binary: 1. For count: amount. For duration: minutes. For checklist:
  // number of steps completed.
  value: number;
  // Optional checklist completion mask (which step indices are checked)
  steps?: number[];
  notes?: string;
  xpAwarded: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// --- trackers (per-goal specialized data: photos, measurements, mood, etc.) ---
export type TrackerKind = "photo" | "measurement" | "mood" | "custom";

export interface Tracker {
  id: string;
  userId: string;
  goalId: string;
  kind: TrackerKind;
  name: string;
  unit?: string;
  cadence: Cadence;
  archived: 0 | 1;
  createdAt: number;
  updatedAt: number;
}

export interface TrackerEntry {
  id: string;
  userId: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  value?: number; // measurement / mood / custom
  text?: string; // notes
  // Photos are stored as Blobs in IndexedDB to avoid base64 bloat.
  photo?: Blob;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Session {
  id: string;
  userId: string;
  goalId: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
  notes?: string;
  xpAwarded: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface UserProfile {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  className: ClassName;
  level: number;
  totalXp: number;
  streakDays: number;
  streakFreezes: number;
  lastActiveDate?: string;
  isPublic: 0 | 1;
  tone: Tone;
  onboardedAt?: number;
  /** Habit adherence, reviews, trust metadata (mirrors user_profile.adherence_json) */
  adherence?: AdherenceProfile;
  createdAt: number;
  updatedAt: number;
  /** yyyy-MM-dd — day for which `dailyBonusXp` was last applied (reversible until midnight) */
  dailyBonusDate?: string;
  /** XP slice included in totalXp as the "daily bar maxed" bonus for dailyBonusDate */
  dailyBonusXp?: number;
}

export interface Achievement {
  id: string;
  userId: string;
  key: string;
  unlockedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  userId: string;
  habitId: string;
  time: string; // HH:mm
  tone: Tone;
  enabled: 0 | 1;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// --- social ---
export interface Friendship {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: number;
  updatedAt: number;
}

export interface Squad {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface SquadMember {
  id: string;
  squadId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: number;
}

export interface AccountabilityStake {
  id: string;
  userId: string;
  goalId: string;
  partnerUserId: string;
  rule: string;
  createdAt: number;
  updatedAt: number;
}

export interface Duel {
  id: string;
  challengerId: string;
  challengeeId: string;
  squadId?: string;
  category: GoalCategory;
  metric: "minutes" | "completions";
  startsAt: number;
  endsAt: number;
  winnerId?: string;
  createdAt: number;
  updatedAt: number;
}

export type FeedEventType =
  | "completion"
  | "level_up"
  | "badge"
  | "miss"
  | "duel_result";

export interface FeedEvent {
  id: string;
  userId: string;
  type: FeedEventType;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface Nudge {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: number;
}

// --- body log (daily weight + progress photo) ---
export interface BodyLog {
  id: string;
  userId: string;
  date: string;      // yyyy-MM-dd (one per day)
  weight?: number;   // kg
  notes?: string;
  blob?: Blob;       // progress photo stored in IndexedDB
  mimeType?: string;
  /** R2 object key when synced (`{authUserId}/body/{id}.ext`) */
  photoStorageKey?: string;
  createdAt: number;
  updatedAt: number;
}

// --- goal journal entries (text / photo attached to a goal by date) ---
export interface GoalEntry {
  id: string;
  userId: string;
  habitId: string; // the goal (habit) this belongs to
  date: string;    // yyyy-MM-dd
  text?: string;
  blob?: Blob;     // photo stored directly in IndexedDB
  mimeType?: string;
  /** R2 object key when synced */
  photoStorageKey?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// --- voice notes ---
export interface VoiceNote {
  id: string;
  userId: string;
  title?: string;
  duration: number; // seconds
  /** Local cache; optional when only `audioStorageKey` is hydrated from cloud */
  blob?: Blob;
  date: string;     // yyyy-MM-dd
  /** R2 object key when synced */
  audioStorageKey?: string;
  mimeType?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// --- sync ---
export interface SyncQueueItem {
  id: string;
  table: string;
  op: "upsert" | "delete";
  recordId: string;
  payload?: unknown;
  enqueuedAt: number;
  attempts: number;
}
