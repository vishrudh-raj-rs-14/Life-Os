import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";
import { shouldSeedVishrudhProfile } from "@/lib/seed";
import { deleteObjectsByPrefix, r2Configured } from "@/lib/r2/s3";

type ResetBody = {
  handle?: string;
  displayName?: string;
  className?: string;
  tone?: string;
  isPublic?: 0 | 1;
  createdAt?: number;
  previousUserId?: string;
};

function jsonError(message: string, status = 500, detail?: unknown) {
  return NextResponse.json({ ok: false, error: message, detail }, { status });
}

async function upsertProfile(admin: any, userId: string, body: ResetBody) {
  const t = Date.now();
  const row = {
    id: userId,
    auth_user_id: userId,
    handle: body.handle || "vishrudh",
    display_name: body.displayName || "Vishrudh",
    class_name: body.className || "polymath",
    level: 1,
    tone: body.tone || "coach",
    total_xp: 0,
    streak_days: 0,
    streak_freezes: 2,
    last_active_date: null,
    is_public: body.isPublic ?? 0,
    daily_bonus_date: null,
    daily_bonus_xp: null,
    created_at: body.createdAt ?? t,
    updated_at: t,
    deleted_at: null,
  };

  const { error } = await admin.from("user_profile").upsert(row);
  if (!error) return;

  if (String(error.message).includes("'level' column")) {
    const { level: _level, ...fallback } = row;
    const retry = await admin.from("user_profile").upsert(fallback);
    if (retry.error) throw retry.error;
    return;
  }

  throw error;
}

function vishrudhHabits(userId: string) {
  const t = Date.now();
  return [
    { title: "Indoor workout", kind: "binary", target: 1, target_mode: "at-least", cadence: "daily", area: "health", color: "#7AA98A", difficulty: 3, weekly_target: 7, cue: "Evening after work" },
    { title: "Outdoor workout", kind: "binary", target: 1, target_mode: "at-least", cadence: "daily", area: "health", color: "#6E9BC9", difficulty: 3, weekly_target: 7, cue: "Morning" },
    { title: "Daily routine", kind: "checklist", target: 4, target_mode: "at-least", cadence: "daily", area: "health", color: "#C9C96E", difficulty: 1, weekly_target: 7, steps: ["Brush teeth (morning)", "Brush teeth (night)", "Skincare", "Hair care"], cue: "After waking up" },
    { title: "Read tech book", kind: "duration", target: 60, unit: "min", target_mode: "at-least", cadence: "daily", area: "mind", color: "#A96EC9", difficulty: 2, weekly_target: 7, cue: "Before lunch or after dinner" },
    { title: "Self-dev book - 10 pages", kind: "count", target: 10, unit: "pages", target_mode: "at-least", cadence: "daily", area: "mind", color: "#C96E9B", difficulty: 2, weekly_target: 7, cue: "Before bed" },
    { title: "Engineering blogs", kind: "binary", target: 1, target_mode: "at-least", cadence: "alt-days", area: "mind", color: "#9BC96E", difficulty: 2, weekly_target: 4, cue: "Morning coffee" },
    { title: "LeetCode / CP - 2 problems", kind: "count", target: 2, unit: "problems", target_mode: "at-least", cadence: "alt-days", area: "craft", color: "#D97757", difficulty: 4, weekly_target: 4, cue: "After morning routine" },
    { title: "Deep work - side project", kind: "duration", target: 120, unit: "min", target_mode: "at-least", cadence: "daily", area: "craft", color: "#C9A96E", difficulty: 4, weekly_target: 7, cue: "Night block after dinner" },
    { title: "Wake up early", kind: "binary", target: 1, target_mode: "at-least", cadence: "daily", area: "lifestyle", color: "#6EC9C9", difficulty: 3, weekly_target: 7, cue: "6 AM alarm" },
  ].map((h) => ({
    id: nanoid(),
    user_id: userId,
    goal_id: null,
    unit: null,
    steps: null,
    custom_days: null,
    scheduled_time: null,
    archived: 0,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    ...h,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return jsonError("SUPABASE_SERVICE_ROLE_KEY is required for reset.", 500);
    }

    const body = (await req.json().catch(() => ({}))) as ResetBody;
    const authClient = await supabaseServer();
    const { data: auth, error: authError } = await authClient.auth.getUser();
    if (authError || !auth.user) return jsonError("Not signed in.", 401, authError);

    const admin: any = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const idsToClear = Array.from(new Set([auth.user.id, body.previousUserId].filter(Boolean))) as string[];
    for (const id of idsToClear) {
      for (const table of [
        "logs",
        "sessions",
        "reminders",
        "tracker_entries",
        "trackers",
        "body_logs",
        "voice_notes",
        "goal_entries",
        "achievements",
        "habits",
        "goals",
      ]) {
        const { error } = await admin.from(table).delete().eq("user_id", id);
        if (error) throw error;
      }
    }

    if (r2Configured()) {
      for (const id of idsToClear) {
        await deleteObjectsByPrefix(`${id}/`);
      }
    }

    await upsertProfile(admin, auth.user.id, body);

    let seeded = 0;
    if (shouldSeedVishrudhProfile(auth.user.email, body.handle)) {
      const habits = vishrudhHabits(auth.user.id);
      const { error } = await admin.from("habits").insert(habits);
      if (error) throw error;
      seeded = habits.length;
    }

    const { data: profile } = await admin
      .from("user_profile")
      .select("total_xp, level, streak_days, daily_bonus_date, daily_bonus_xp")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle();
    const { count: habitCount } = await admin
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id);

    return NextResponse.json({
      ok: true,
      userId: auth.user.id,
      email: auth.user.email,
      seeded,
      habitCount,
      profile,
    });
  } catch (err) {
    console.error("Reset failed:", err);
    return jsonError("Reset failed.", 500, err);
  }
}

