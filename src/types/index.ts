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

export type Difficulty = 1 | 2 | 3;

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
  archived: 0 | 1;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
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
  createdAt: number;
  updatedAt: number;
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

// --- goal journal entries (text / photo attached to a goal by date) ---
export interface GoalEntry {
  id: string;
  userId: string;
  habitId: string; // the goal (habit) this belongs to
  date: string;    // yyyy-MM-dd
  text?: string;
  blob?: Blob;     // photo stored directly in IndexedDB
  mimeType?: string;
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
  blob: Blob;       // audio blob stored directly in IndexedDB
  date: string;     // yyyy-MM-dd
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
