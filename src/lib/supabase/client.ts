import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton browser client — reuse across the app
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!url || !key) return null;
  if (!_client) _client = createBrowserClient(url, key);
  return _client;
}

export function authRedirectUrl() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || "";
  return `${base}/auth/callback`;
}
