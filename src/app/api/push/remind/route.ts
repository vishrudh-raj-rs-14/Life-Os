import { NextRequest, NextResponse } from "next/server";

// Store per-habit reminder schedules linked to a push subscription endpoint.
// Called from the client whenever a habit is saved with a reminder time.
//
// Supabase table needed (run in your SQL editor):
//
//   create table if not exists reminder_schedules (
//     id          text primary key,
//     endpoint    text not null,
//     habit_id    text not null,
//     habit_title text not null,
//     remind_time text not null,          -- "HH:MM"
//     days        integer[] not null,     -- [0..6], 0=Sun
//     updated_at  timestamptz default now(),
//     unique(endpoint, habit_id)
//   );
//   alter table reminder_schedules enable row level security;
//   create policy "service_all" on reminder_schedules for all using (true) with check (true);

export async function POST(req: NextRequest) {
  try {
    const { endpoint, habitId, habitTitle, remindTime, days } = await req.json();
    if (!endpoint || !habitId || !remindTime) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, note: "Supabase not configured" });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/reminder_schedules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: `${endpoint.slice(-12)}_${habitId}`,
        endpoint,
        habit_id: habitId,
        habit_title: habitTitle,
        remind_time: remindTime,
        days: days ?? [0,1,2,3,4,5,6],
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("reminder_schedules upsert error:", err);
      return NextResponse.json({ ok: false, error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Push remind error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove reminder when habit reminder is cleared
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint, habitId } = await req.json();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ ok: true });

    await fetch(
      `${supabaseUrl}/rest/v1/reminder_schedules?habit_id=eq.${habitId}&endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: "DELETE",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
