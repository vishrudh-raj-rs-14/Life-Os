import { nanoid } from "nanoid";
import type { ClassName, Goal, Habit, Tracker, UserProfile } from "@/types";
import { LOCAL_USER_ID } from "@/lib/utils";
import { getRepo } from "@/lib/repo";

const VISHRUDH_SEED_EMAILS = new Set([
  "vishrudh.shrinivas@gmail.com",
  "vishrudh.shrinvias@gmail.com",
]);

export function shouldSeedVishrudhProfile(email?: string | null, handle?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedHandle = handle?.trim().toLowerCase();
  return normalizedHandle === "vishrudh" || (normalizedEmail ? VISHRUDH_SEED_EMAILS.has(normalizedEmail) : false);
}

interface SeedOpts {
  className: ClassName;
  handle: string;
  displayName: string;
  tone?: "coach" | "drill-sergeant" | "wise";
  selectedGoalKeys?: string[];
}

type HabitSeed = Omit<
  Habit,
  "id" | "userId" | "goalId" | "createdAt" | "updatedAt" | "archived"
>;

type TrackerSeed = Omit<
  Tracker,
  "id" | "userId" | "goalId" | "createdAt" | "updatedAt" | "archived"
>;

interface GoalSeed {
  key: string;
  title: string;
  category: Goal["category"];
  area: NonNullable<Goal["area"]>;
  color: string;
  icon: string;
  why: string;
  outcome: string;
  metricLabel: string;
  metricTarget: number;
  weeklyTargetMinutes: number;
  dailyTargetMinutes?: number;
  habits: HabitSeed[];
  trackers?: TrackerSeed[];
}

// Each starter goal showcases a different habit *kind* so the user immediately
// sees the variety the system supports.
export const STARTER_GOALS: GoalSeed[] = [
  {
    key: "system-design",
    title: "Master System Design",
    category: "learn",
    area: "career",
    color: "#C9A961",
    icon: "Network",
    why: "So I can architect serious systems and lead engineering decisions.",
    outcome: "Comfortably whiteboard a Twitter / Uber-scale design.",
    metricLabel: "deep-study hours",
    metricTarget: 120,
    weeklyTargetMinutes: 300,
    dailyTargetMinutes: 45,
    habits: [
      {
        title: "Engineering blog read",
        kind: "count",
        unit: "posts",
        target: 1,
        targetMode: "at-least",
        cadence: "daily",
        cue: "After morning coffee",
        scheduledTime: "08:30",
        difficulty: 2,
      },
      {
        title: "Deep study block",
        kind: "duration",
        unit: "min",
        target: 45,
        targetMode: "at-least",
        cadence: "daily",
        cue: "Phone in another room",
        scheduledTime: "20:00",
        difficulty: 3,
      },
    ],
  },
  {
    key: "leetcode",
    title: "LeetCode / CP",
    category: "code",
    area: "career",
    color: "#D97757",
    icon: "Code2",
    why: "Sharpen problem solving and crack harder interviews.",
    outcome: "Solve 200 mediums + 50 hards.",
    metricLabel: "problems solved",
    metricTarget: 250,
    weeklyTargetMinutes: 240,
    dailyTargetMinutes: 30,
    habits: [
      {
        title: "Solve problems",
        kind: "count",
        unit: "problems",
        target: 2,
        targetMode: "at-least",
        cadence: "alt-days",
        cue: "Right after lunch",
        scheduledTime: "13:30",
        difficulty: 3,
      },
    ],
  },
  {
    key: "projects",
    title: "Ship My Projects",
    category: "code",
    area: "craft",
    color: "#7AA98A",
    icon: "Rocket",
    why: "Build a body of work that compounds in opportunity.",
    outcome: "Ship 3 launched projects this year.",
    metricLabel: "deep work hours",
    metricTarget: 600,
    weeklyTargetMinutes: 600,
    dailyTargetMinutes: 90,
    habits: [
      {
        title: "Deep work block",
        kind: "duration",
        unit: "min",
        target: 90,
        targetMode: "at-least",
        cadence: "daily",
        cue: "Phone across the room, headphones on",
        scheduledTime: "20:00",
        difficulty: 3,
      },
    ],
  },
  {
    key: "fitness",
    title: "Two Workouts a Day",
    category: "fitness",
    area: "health",
    color: "#7AA98A",
    icon: "Dumbbell",
    why: "Energy, mood, and longevity are upstream of everything.",
    outcome: "Hit 12% body fat and bench bodyweight x1.25.",
    metricLabel: "workouts completed",
    metricTarget: 200,
    weeklyTargetMinutes: 420,
    dailyTargetMinutes: 60,
    habits: [
      {
        title: "Morning workout",
        kind: "binary",
        target: 1,
        targetMode: "at-least",
        cadence: "daily",
        cue: "Gym clothes laid out the night before",
        scheduledTime: "06:30",
        difficulty: 2,
      },
      {
        title: "Evening lift",
        kind: "checklist",
        target: 5,
        targetMode: "at-least",
        steps: [
          "Warm up (5 min cardio)",
          "Compound lift x 5",
          "Accessory x 4",
          "Core finisher",
          "Stretch + log session",
        ],
        cadence: "alt-days",
        cue: "Phone on Do Not Disturb",
        scheduledTime: "18:00",
        difficulty: 2,
      },
    ],
    trackers: [
      {
        kind: "measurement",
        name: "Body weight",
        unit: "kg",
        cadence: "weekly",
      },
      { kind: "photo", name: "Progress photo", cadence: "weekly" },
    ],
  },
  {
    key: "self-dev",
    title: "Read a Self-Dev Book",
    category: "read",
    area: "mind",
    color: "#C9A961",
    icon: "BookOpen",
    why: "Slow, deliberate input shapes how I think.",
    outcome: "Read 12 books and keep notes on each.",
    metricLabel: "pages read",
    metricTarget: 3000,
    weeklyTargetMinutes: 140,
    dailyTargetMinutes: 20,
    habits: [
      {
        title: "Read pages",
        kind: "count",
        unit: "pages",
        target: 10,
        targetMode: "at-least",
        cadence: "daily",
        cue: "Before bed, no phone",
        scheduledTime: "22:30",
        difficulty: 1,
      },
    ],
  },
  {
    key: "early-rise",
    title: "Wake Up Early",
    category: "wake",
    area: "lifestyle",
    color: "#C9A961",
    icon: "Sunrise",
    why: "The early hours are mine before the world claims them.",
    outcome: "Up by 6 AM 90% of days.",
    metricLabel: "early days",
    metricTarget: 300,
    weeklyTargetMinutes: 0,
    habits: [
      {
        title: "Wake up by 6:00 AM",
        kind: "binary",
        target: 1,
        targetMode: "at-least",
        cadence: "daily",
        cue: "Phone across the room",
        scheduledTime: "06:00",
        difficulty: 3,
      },
    ],
    trackers: [{ kind: "mood", name: "Morning mood", cadence: "daily" }],
  },
];

export async function seedStarter(opts: SeedOpts) {
  const repo = await getRepo();
  const t = Date.now();
  // Cloud-first: prefer Supabase auth uid as the stable per-account user id.
  // Falls back to LOCAL_USER_ID for offline/local dev.
  const authUid = await (async () => {
    try {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const sb = supabaseBrowser();
      if (!sb) return undefined;
      const { data } = await sb.auth.getUser();
      return data.user?.id ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const userId = authUid ?? LOCAL_USER_ID;

  const profile: UserProfile = {
    userId,
    handle: opts.handle,
    displayName: opts.displayName,
    className: opts.className,
    level: 1,
    totalXp: 0,
    streakDays: 0,
    streakFreezes: 2,
    isPublic: 0,
    tone: opts.tone ?? "coach",
    onboardedAt: t,
    createdAt: t,
    updatedAt: t,
  };
  await repo.upsertUser(profile);

  // Only seed goals explicitly requested — pass empty array for a clean start.
  const selected = new Set(opts.selectedGoalKeys ?? []);

  for (const g of STARTER_GOALS) {
    if (!selected.has(g.key)) continue;
    const goalId = nanoid();
    await repo.upsertGoal({
      id: goalId,
      userId,
      title: g.title,
      category: g.category,
      area: g.area,
      color: g.color,
      icon: g.icon,
      why: g.why,
      outcome: g.outcome,
      metricLabel: g.metricLabel,
      metricTarget: g.metricTarget,
      reviewCadence: "weekly",
      weeklyTargetMinutes: g.weeklyTargetMinutes,
      dailyTargetMinutes: g.dailyTargetMinutes,
      archived: 0,
      createdAt: t,
      updatedAt: t,
    });
    for (const h of g.habits) {
      await repo.upsertHabit({
        id: nanoid(),
        userId,
        goalId,
        ...h,
        archived: 0,
        createdAt: t,
        updatedAt: t,
      });
    }
    for (const tr of g.trackers ?? []) {
      await repo.upsertTracker({
        id: nanoid(),
        userId,
        goalId,
        ...tr,
        archived: 0,
        createdAt: t,
        updatedAt: t,
      });
    }
  }
}

// ─── Vishrudh's personal starter goals ───────────────────────────────────────
// Seeds directly into the habits table (flat model — habit IS the goal).

export async function seedVishrudh(userIdOverride?: string) {
  const t = Date.now();
  const authUid = userIdOverride ?? await (async () => {
    try {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const sb = supabaseBrowser();
      if (!sb) return undefined;
      const { data } = await sb.auth.getUser();
      return data.user?.id ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const userId = authUid ?? LOCAL_USER_ID;

  const habits: Omit<Habit, "id">[] = [
    {
      userId,
      title: "Indoor workout",
      kind: "binary",
      target: 1,
      targetMode: "at-least",
      cadence: "daily",
      area: "health",
      color: "#7AA98A",
      difficulty: 3,
      weeklyTarget: 7,
      cue: "Evening after work",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Outdoor workout",
      kind: "binary",
      target: 1,
      targetMode: "at-least",
      cadence: "daily",
      area: "health",
      color: "#6E9BC9",
      difficulty: 3,
      weeklyTarget: 7,
      cue: "Morning",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Daily routine",
      kind: "checklist",
      target: 4,
      targetMode: "at-least",
      cadence: "daily",
      area: "health",
      color: "#C9C96E",
      difficulty: 1,
      weeklyTarget: 7,
      steps: ["Brush teeth (morning)", "Brush teeth (night)", "Skincare", "Hair care"],
      cue: "After waking up",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Read tech book",
      kind: "duration",
      target: 60,
      unit: "min",
      targetMode: "at-least",
      cadence: "daily",
      area: "mind",
      color: "#A96EC9",
      difficulty: 2,
      weeklyTarget: 7,
      cue: "Before lunch or after dinner",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Self-dev book — 10 pages",
      kind: "count",
      target: 10,
      unit: "pages",
      targetMode: "at-least",
      cadence: "daily",
      area: "mind",
      color: "#C96E9B",
      difficulty: 2,
      weeklyTarget: 7,
      cue: "Before bed",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Engineering blogs",
      kind: "binary",
      target: 1,
      targetMode: "at-least",
      cadence: "alt-days",
      area: "mind",
      color: "#9BC96E",
      difficulty: 2,
      weeklyTarget: 4,
      cue: "Morning coffee",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "LeetCode / CP — 2 problems",
      kind: "count",
      target: 2,
      unit: "problems",
      targetMode: "at-least",
      cadence: "alt-days",
      area: "craft",
      color: "#D97757",
      difficulty: 4,
      weeklyTarget: 4,
      cue: "After morning routine",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Deep work — side project",
      kind: "duration",
      target: 120,
      unit: "min",
      targetMode: "at-least",
      cadence: "daily",
      area: "craft",
      color: "#C9A96E",
      difficulty: 4,
      weeklyTarget: 7,
      cue: "Night block after dinner",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      userId,
      title: "Wake up early",
      kind: "binary",
      target: 1,
      targetMode: "at-least",
      cadence: "daily",
      area: "lifestyle",
      color: "#6EC9C9",
      difficulty: 3,
      weeklyTarget: 7,
      cue: "6 AM alarm",
      archived: 0,
      createdAt: t,
      updatedAt: t,
    },
  ];

  const repo = await getRepo();
  for (const h of habits) {
    await repo.upsertHabit({ id: nanoid(), ...h });
  }
  return habits.length;
}
