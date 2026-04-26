import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  assertSafeObjectId,
  buildObjectKey,
  putObjectBytes,
  r2Configured,
} from "@/lib/r2/s3";
import type { R2MediaCategory } from "@/lib/r2/types";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const MAX_BYTES = 32 * 1024 * 1024; // 32 MiB — voice notes / photos

/**
 * Same-origin multipart upload: browser → Next → R2.
 * Avoids configuring R2 bucket CORS for cross-origin PUT.
 */
export async function POST(req: NextRequest) {
  try {
    if (!r2Configured()) {
      return jsonError("R2 is not configured (missing R2_* env vars).", 503);
    }

    const supabase = await supabaseServer();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return jsonError("Not signed in.", 401);

    const form = await req.formData();
    const category = form.get("category");
    const objectId = form.get("objectId");
    const file = form.get("file");

    if (typeof category !== "string" || typeof objectId !== "string") {
      return jsonError("category and objectId are required.");
    }
    if (category !== "body" && category !== "voice" && category !== "goal") {
      return jsonError("Invalid category.");
    }
    if (!(file instanceof Blob) || file.size === 0) {
      return jsonError("Non-empty file is required.");
    }
    if (file.size > MAX_BYTES) {
      return jsonError(`File too large (max ${MAX_BYTES / (1024 * 1024)} MiB).`, 413);
    }

    assertSafeObjectId(objectId);

    const contentType = file.type?.trim() || "application/octet-stream";
    const key = buildObjectKey(
      auth.user.id,
      category as R2MediaCategory,
      objectId,
      contentType
    );
    const buf = new Uint8Array(await file.arrayBuffer());
    await putObjectBytes(key, buf, contentType);

    return NextResponse.json({ ok: true, key });
  } catch (e) {
    console.error("media upload:", e);
    return jsonError(e instanceof Error ? e.message : "Upload failed.", 500);
  }
}
