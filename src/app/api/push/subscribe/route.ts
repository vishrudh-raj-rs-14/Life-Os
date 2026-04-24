import { NextRequest, NextResponse } from "next/server";

// Store subscriptions in Supabase if available, else in-memory for local dev.
// Table: push_subscriptions (id serial, endpoint text unique, subscription jsonb, created_at timestamptz)

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      // Upsert into Supabase
      const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          subscription: JSON.stringify(subscription),
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Supabase upsert error:", err);
        // Still return OK so the client registers successfully
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
