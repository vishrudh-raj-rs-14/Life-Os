import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { assertKeyOwnedByUser, deleteObjectKey, r2Configured } from "@/lib/r2/s3";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    if (!r2Configured()) {
      return jsonError("R2 is not configured.", 503);
    }
    const supabase = await supabaseServer();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonError("Not signed in.", 401);

    const body = (await req.json().catch(() => ({}))) as { key?: string };
    const key = body.key?.trim();
    if (!key) return jsonError("key is required.");

    assertKeyOwnedByUser(key, auth.user.id);
    await deleteObjectKey(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("media delete:", e);
    return jsonError(e instanceof Error ? e.message : "Delete failed.", 500);
  }
}
