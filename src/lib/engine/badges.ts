import type { Achievement, Goal, Log, Session, UserProfile } from "@/types";

export interface BadgeDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  check: (ctx: BadgeCtx) => boolean;
}

export interface BadgeCtx {
  user: UserProfile;
  goals: Goal[];
  sessions: Session[];
  logs: Log[];
}

const totalMinutes = (sessions: Session[]) =>
  sessions.reduce((a, s) => a + s.minutes, 0);

const minutesForGoal = (sessions: Session[], goalId: string) =>
  sessions.filter((s) => s.goalId === goalId).reduce((a, s) => a + s.minutes, 0);

export const BADGES: BadgeDef[] = [
  {
    key: "first-step",
    title: "First Step",
    description: "Complete your first quest.",
    icon: "Footprints",
    check: ({ logs }) => logs.length >= 1,
  },
  {
    key: "first-hour",
    title: "First Hour",
    description: "Log 60 minutes of focused work.",
    icon: "Hourglass",
    check: ({ sessions }) => totalMinutes(sessions) >= 60,
  },
  {
    key: "ten-hours",
    title: "Deep Diver",
    description: "Log 10 hours of focused work.",
    icon: "Anchor",
    check: ({ sessions }) => totalMinutes(sessions) >= 600,
  },
  {
    key: "fifty-hours",
    title: "Half Centurion",
    description: "Log 50 hours of focused work.",
    icon: "Trophy",
    check: ({ sessions }) => totalMinutes(sessions) >= 3000,
  },
  {
    key: "week-streak",
    title: "Week Warrior",
    description: "Hit a 7-day streak.",
    icon: "Flame",
    check: ({ user }) => user.streakDays >= 7,
  },
  {
    key: "month-streak",
    title: "Iron Discipline",
    description: "Hit a 30-day streak.",
    icon: "Mountain",
    check: ({ user }) => user.streakDays >= 30,
  },
  {
    key: "level-5",
    title: "Apprentice",
    description: "Reach level 5.",
    icon: "Star",
    check: ({ user }) => user.level >= 5,
  },
  {
    key: "level-10",
    title: "Adept",
    description: "Reach level 10.",
    icon: "Sparkles",
    check: ({ user }) => user.level >= 10,
  },
  {
    key: "level-25",
    title: "Master",
    description: "Reach level 25.",
    icon: "Crown",
    check: ({ user }) => user.level >= 25,
  },
  {
    key: "goal-10h",
    title: "Goal Specialist",
    description: "Spend 10 hours on a single goal.",
    icon: "Target",
    check: ({ goals, sessions }) =>
      goals.some((g) => minutesForGoal(sessions, g.id) >= 600),
  },
  {
    key: "compound",
    title: "Compounding",
    description: "Hit a goal's weekly target 3 weeks in a row.",
    icon: "TrendingUp",
    check: () => false, // set externally based on consecutiveWeeksHit
  },
];

export function evaluateBadges(
  ctx: BadgeCtx,
  unlocked: Achievement[]
): BadgeDef[] {
  const have = new Set(unlocked.map((a) => a.key));
  return BADGES.filter((b) => !have.has(b.key) && b.check(ctx));
}
