import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, body: msgBody, url, tag, secret } = body as Record<string, string>;

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
    const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
    const email      = process.env.VAPID_EMAIL ?? "mailto:admin@lifeos.app";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Prefer service-role key (bypasses RLS) — falls back to anon key in dev
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 });
    }
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // Fetch subscriptions — handle the case where the table doesn't exist yet
    const res = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?select=subscription`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      // Table might not exist — return 0 sent rather than a 500
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

    const payload = JSON.stringify({ title, body: msgBody, url: url ?? "/", tag });
    const results = await Promise.allSettled(
      (rows as Array<{ subscription: string }>).map(async (row) => {
        const sub = JSON.parse(row.subscription);
        await webpush.sendNotification(sub, payload);
      })
    );

    return NextResponse.json({
      sent:   results.filter(r => r.status === "fulfilled").length,
      failed: results.filter(r => r.status === "rejected").length,
    });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Life OS push endpoint live" });
}
