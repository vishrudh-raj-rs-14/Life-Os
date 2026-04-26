"use client";

import { useEffect, useState } from "react";
import { r2SignedGetUrl } from "./r2Client";

/** Resolves a short-lived signed GET URL for an R2 object key (empty if missing or error). */
export function useSignedMediaUrl(storageKey?: string) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!storageKey) {
      const t = setTimeout(() => setUrl(""), 0);
      return () => clearTimeout(t);
    }
    let alive = true;
    void (async () => {
      try {
        const u = await r2SignedGetUrl(storageKey);
        if (alive) setUrl(u);
      } catch {
        if (alive) setUrl("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [storageKey]);

  return url;
}
