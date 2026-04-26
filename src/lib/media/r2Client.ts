"use client";

import type { R2MediaCategory } from "@/lib/r2/types";

export async function r2UploadBlob(
  category: R2MediaCategory,
  objectId: string,
  blob: Blob
): Promise<string> {
  const contentType = blob.type || "application/octet-stream";
  // Same-origin upload → server writes to R2 (no R2 CORS needed for PUT).
  const form = new FormData();
  form.set("category", category);
  form.set("objectId", objectId);
  form.set("file", blob, `${objectId}${contentType.includes("webm") ? ".webm" : ".bin"}`);

  const res = await fetch("/api/media/upload", {
    method: "POST",
    body: form,
  });
  const j = (await res.json()) as { ok?: boolean; error?: string; key?: string };
  if (!res.ok || !j.ok || !j.key) {
    throw new Error(j.error || "Upload failed");
  }
  return j.key;
}

export async function r2SignedGetUrl(key: string): Promise<string> {
  const res = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "get", key }),
  });
  const j = (await res.json()) as { ok?: boolean; error?: string; url?: string };
  if (!res.ok || !j.ok || !j.url) {
    throw new Error(j.error || "Presign GET failed");
  }
  return j.url;
}

export async function r2DeleteKey(key: string): Promise<void> {
  const res = await fetch("/api/media/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const j = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !j.ok) {
    throw new Error(j.error || "R2 delete failed");
  }
}

export async function r2WipeUserPrefix(): Promise<void> {
  await fetch("/api/media/wipe", { method: "POST" });
}
