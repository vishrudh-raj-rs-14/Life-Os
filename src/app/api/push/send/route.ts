import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Notification content per type ───────────────────────────────────────────

type NotifType =
  | "morning"
  | "midday"
  | "streak"
  | "recap"
  | "daymiss"
  | "custom";

const MESSAGES: Record<NotifType, { title: string; body: string }> = {
  morning: {
    title: "Life OS — good morning ☀️",
    body: "Your goals are waiting. Let's get today's work done.",
  },
  midday: {
    title: "Halfway through the day",
    body: "How are your goals going? A few minutes now adds up.",
  },
  streak: {
    title: "🔥 Streak check",
    body: "Don't break your streak tonight. Log at least one goal.",
  },
  recap: {
    title: "End of day recap",
    body: "How did today go? Review your progress before bed.",
  },
  daymiss: {
    title: "Yesterday was a miss.",
    body: "Don't let it become two. Start strong today.",
  },
  custom: {
    title: "Life OS",
    body: "Time to check in.",
  },
};

// ─── Secret validation (supports both POST body and GET query param) ──────────

function isAuthorised(req: NextRequest, body: Record<string, string>): boolean {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  if (!cronSecret) return false;
  // POST: secret in JSON body
  if (body.secret === cronSecret) return true;
  // GET / query param (Vercel cron path includes ?secret=...)
  if (req.nextUrl.searchParams.get("secret") === cronSecret) return true;
  // Authorization: Bearer <secret> header (standard Vercel cron pattern)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handleSend(req: NextRequest, bodyObj: Record<string, string>) {
  const publicKey  = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const email      = (process.env.VAPID_EMAIL ?? "mailto:admin@lifeos.app").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 });
  }
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Resolve notification type → pick content
  const type = (
    bodyObj.type ?? req.nextUrl.searchParams.get("type") ?? "custom"
  ) as NotifType;
  const template = MESSAGES[type] ?? MESSAGES.custom;

  const title = bodyObj.title || template.title;
  const body  = bodyObj.body  || template.body;
  const tag   = bodyObj.tag   || type;
  const url   = bodyObj.url   || "/";

  // Fetch subscriptions
  const res = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?select=subscription`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn("push_subscriptions fetch failed:", err);
    return NextResponse.json({
      sent: 0, failed: 0,
      note: "push_subscriptions table not ready. Run the SQL migration in Supabase.",
    });
  }

  const rows: unknown = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, note: "No subscribers yet." });
  }

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(email, publicKey, privateKey);

  // ── Generic broadcast to all subscribers ──────────────────────────────────
  const payload = JSON.stringify({ title, body, url, tag });
  const results = await Promise.allSettled(
    (rows as Array<{ subscription: string }>).map(async (row) => {
      const sub = JSON.parse(row.subscription);
      await webpush.sendNotification(sub, payload);
    })
  );

  // ── Per-habit reminders: fire for schedules matching current HH:MM ────────
  let remindersSent = 0;
  try {
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // UTC → IST
    const hh = String(nowIST.getUTCHours()).padStart(2, "0");
    const mm = String(nowIST.getUTCMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const todayDow = nowIST.getUTCDay(); // 0=Sun…6=Sat

    // Fetch reminders due now (match HH only — within 30-min window)
    const [hCurrent] = currentTime.split(":");
    const remRes = await fetch(
      `${supabaseUrl}/rest/v1/reminder_schedules?select=endpoint,habit_title,remind_time,days`,
      { headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (remRes.ok) {
      const remRows = await remRes.json() as Array<{
        endpoint: string; habit_title: string; remind_time: string; days: number[];
      }>;
      const due = remRows.filter(r => {
        const [hRem] = r.remind_time.split(":");
        return hRem === hCurrent && r.days.includes(todayDow);
      });
      // Fetch push subscription JSON for each endpoint
      const subRes = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,subscription`,
        { headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (subRes.ok) {
        const subs = await subRes.json() as Array<{ endpoint: string; subscription: string }>;
        const subMap = new Map(subs.map(s => [s.endpoint, s.subscription]));
        await Promise.allSettled(
          due.map(async r => {
            const subJson = subMap.get(r.endpoint);
            if (!subJson) return;
            const p = JSON.stringify({
              title: `⏰ Time for: ${r.habit_title}`,
              body: `Your ${r.remind_time} reminder. Let's go.`,
              url: "/",
              tag: `reminder_${r.habit_title}`,
            });
            await webpush.sendNotification(JSON.parse(subJson), p);
            remindersSent++;
          })
        );
      }
    }
  } catch (remErr) {
    console.warn("Reminder send error (non-fatal):", remErr);
  }

  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`[push/send] type=${type} sent=${sent} failed=${failed} reminders=${remindersSent}`);
  return NextResponse.json({ sent, failed, type, remindersSent });
}

// GET — used by Vercel cron jobs (secret + type in query string)
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorised(req, {})) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleSend(req, {});
  } catch (err) {
    console.error("Push GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — used for manual curl tests and admin triggers
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, string>;
    if (!isAuthorised(req, body)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleSend(req, body);
  } catch (err) {
    console.error("Push POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
