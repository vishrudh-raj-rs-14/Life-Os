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

// Always use the Vercel production URL for the OAuth redirect so Google
// never bounces back to localhost after signing in on the live site.
export function authRedirectUrl() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/auth/callback`;
}
