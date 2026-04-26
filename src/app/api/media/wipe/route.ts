import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { deleteObjectsByPrefix, r2Configured } from "@/lib/r2/s3";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Deletes all R2 objects under the signed-in user's prefix (`{authUserId}/`). */
export async function POST() {
  try {
    if (!r2Configured()) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const supabase = await supabaseServer();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonError("Not signed in.", 401);

    await deleteObjectsByPrefix(`${auth.user.id}/`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("media wipe:", e);
    return jsonError(e instanceof Error ? e.message : "Wipe failed.", 500);
  }
}
