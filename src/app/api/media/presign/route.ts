import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { presignGet, presignPut, r2Configured } from "@/lib/r2/s3";
import type { R2MediaCategory } from "@/lib/r2/types";

type Body = {
  op: "put" | "get";
  category?: R2MediaCategory;
  objectId?: string;
  contentType?: string;
  key?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    if (!r2Configured()) {
      return jsonError("R2 is not configured (missing R2_* env vars).", 503);
    }

    const supabase = await supabaseServer();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonError("Not signed in.", 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.op === "put") {
      if (!body.category || !body.objectId)
        return jsonError("put requires category and objectId.");
      if (body.category !== "body" && body.category !== "voice" && body.category !== "goal") {
        return jsonError("Invalid category.");
      }
      const contentType = body.contentType?.trim() || "application/octet-stream";
      const { url, key, headers } = await presignPut(auth.user.id, body.category, body.objectId, contentType);
      return NextResponse.json({ ok: true, url, key, headers, method: "PUT" });
    }
    if (body.op === "get") {
      if (!body.key?.trim()) return jsonError("get requires key.");
      const url = await presignGet(auth.user.id, body.key.trim());
      return NextResponse.json({ ok: true, url, method: "GET" });
    }
    return jsonError("op must be put or get.");
  } catch (e) {
    console.error("presign:", e);
    return jsonError(e instanceof Error ? e.message : "Presign failed.", 500);
  }
}
