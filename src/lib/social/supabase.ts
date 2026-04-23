import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(url && key);
}

export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!_client) _client = createClient(url!, key!);
  return _client;
}
