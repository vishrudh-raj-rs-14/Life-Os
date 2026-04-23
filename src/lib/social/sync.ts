"use client";

import { db } from "@/lib/db/dexie";
import { supabase, hasSupabase } from "./supabase";
import type { SyncQueueItem } from "@/types";

const TABLE_TO_REMOTE: Record<string, string> = {
  goals: "goals",
  habits: "habits",
  logs: "logs",
  sessions: "sessions",
  user: "user_profile",
  achievements: "achievements",
  reminders: "reminders",
  friendships: "friendships",
  squads: "squads",
  squadMembers: "squad_members",
  stakes: "accountability_stakes",
  duels: "duels",
  feed: "feed_events",
  nudges: "nudges",
};

export async function enqueue(
  table: string,
  recordId: string,
  op: "upsert" | "delete",
  payload?: unknown
) {
  await db().syncQueue.put({
    id: `${table}:${recordId}:${Date.now()}`,
    table,
    recordId,
    op,
    payload,
    enqueuedAt: Date.now(),
    attempts: 0,
  } satisfies SyncQueueItem);
}

export async function flushQueue() {
  if (!hasSupabase()) return;
  const sb = supabase();
  if (!sb) return;
  const items = await db().syncQueue.orderBy("enqueuedAt").toArray();
  for (const it of items) {
    const remote = TABLE_TO_REMOTE[it.table];
    if (!remote) {
      await db().syncQueue.delete(it.id);
      continue;
    }
    try {
      if (it.op === "upsert") {
        await sb.from(remote).upsert(it.payload as Record<string, unknown>);
      } else {
        await sb.from(remote).delete().eq("id", it.recordId);
      }
      await db().syncQueue.delete(it.id);
    } catch {
      await db().syncQueue.update(it.id, { attempts: it.attempts + 1 });
      if (it.attempts >= 5) await db().syncQueue.delete(it.id);
    }
  }
}

export function startSyncLoop() {
  if (typeof window === "undefined") return;
  if (!hasSupabase()) return;
  void flushQueue();
  window.addEventListener("online", () => void flushQueue());
  setInterval(() => void flushQueue(), 60_000);
}
