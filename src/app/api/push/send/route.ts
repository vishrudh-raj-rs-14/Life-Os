import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@lifeos.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

// Called by Vercel cron at scheduled times.
// Body: { title, body, url?, tag?, secret }
export async function POST(req: NextRequest) {
  try {
    // Simple shared secret so the cron endpoint isn't public
    const { title, body, url, tag, secret } = await req.json();
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // Fetch all subscriptions
    const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=subscription`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });
    const rows: Array<{ subscription: string }> = await res.json();

    const payload = JSON.stringify({ title, body, url: url ?? "/", tag });
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const sub = JSON.parse(row.subscription);
        await webpush.sendNotification(sub, payload);
      })
    );

    const sent   = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    return NextResponse.json({ sent, failed });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Also allow GET for manual testing from the browser
export async function GET() {
  return NextResponse.json({ status: "push endpoint live" });
}
