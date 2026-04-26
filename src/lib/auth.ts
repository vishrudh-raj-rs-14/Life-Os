"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export interface CachedAuthUser {
  id: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

let cachedUser: CachedAuthUser | null | undefined;
let initPromise: Promise<CachedAuthUser | null> | null = null;
let listening = false;

function normalizeUser(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined
): CachedAuthUser | null {
  return user ? { id: user.id, email: user.email, metadata: user.user_metadata } : null;
}

export function getCachedAuthUser() {
  return cachedUser ?? null;
}

export async function ensureAuthUser(opts?: { force?: boolean }): Promise<CachedAuthUser | null> {
  if (!opts?.force && cachedUser !== undefined) return cachedUser;
  if (initPromise) return initPromise;

  const sb = supabaseBrowser();
  if (!sb) {
    cachedUser = null;
    return null;
  }

  initPromise = sb.auth
    .getUser()
    .then((result: { data: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null } }) => {
      cachedUser = normalizeUser(result.data.user);
      return cachedUser;
    })
    .catch(() => {
      cachedUser = null;
      return null;
    })
    .finally(() => {
      initPromise = null;
    });

  return initPromise;
}

export function primeAuthUser(user: CachedAuthUser | null) {
  cachedUser = user;
}

export function startAuthCache() {
  if (listening) return;
  const sb = supabaseBrowser();
  if (!sb) return;
  listening = true;

  void ensureAuthUser();
  sb.auth.onAuthStateChange((
    _event: string,
    session: { user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null
  ) => {
    cachedUser = normalizeUser(session?.user);
  });
}

