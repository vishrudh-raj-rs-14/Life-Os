"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/dexie";
import { useUser } from "@/store/useUser";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { LOCAL_USER_ID } from "@/lib/utils";
import { hasSupabase } from "@/lib/social/supabase";
import { toast } from "@/components/ui/Toast";

export default function FriendsPage() {
  const { user } = useUser();
  const [handle, setHandle] = useState("");
  const friendships = useLiveQuery(() => db().friendships.toArray(), []);

  if (!user) return null;

  async function add() {
    const target = handle.trim().toLowerCase().replace(/^@/, "");
    if (!target) return;
    if (target === user!.handle) {
      toast({ title: "That's you.", emoji: "🙃" });
      return;
    }
    await db().friendships.put({
      id: nanoid(),
      fromUserId: LOCAL_USER_ID,
      toUserId: target,
      status: hasSupabase() ? "pending" : "accepted",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    toast({
      emoji: "🤝",
      title: hasSupabase() ? "Request sent" : `Added @${target}`,
      description: hasSupabase()
        ? "They'll get a notification."
        : "Cloud not configured — local only.",
    });
    setHandle("");
  }

  const accepted = (friendships ?? []).filter((f) => f.status === "accepted");
  const pending = (friendships ?? []).filter((f) => f.status === "pending");

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/profile" className="rounded-md p-2 -ml-2 hover:bg-[var(--surface)]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="os-label">Network</div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">Friends</h1>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Add by handle</Label>
        <div className="flex gap-2">
          <Input
            placeholder="vish"
            value={handle}
            onChange={(e) =>
              setHandle(e.target.value.replace(/[^a-z0-9_@]/gi, ""))
            }
          />
          <Button onClick={add}>
            <UserPlus size={16} /> Add
          </Button>
        </div>
        {!hasSupabase() && (
          <p className="text-[11px] text-[var(--ink-3)] font-mono">
            cloud not configured — friendships saved locally for testing
          </p>
        )}
      </div>

      <Section title={`Friends · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <Empty>No friends yet.</Empty>
        ) : (
          accepted.map((f) => (
            <Row key={f.id} handle={f.toUserId} status="Friend" />
          ))
        )}
      </Section>

      {pending.length > 0 && (
        <Section title={`Pending · ${pending.length}`}>
          {pending.map((f) => (
            <Row key={f.id} handle={f.toUserId} status="Pending" />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="os-label mb-2">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ handle, status }: { handle: string; status: string }) {
  return (
    <Link
      href={`/u/${handle}`}
      className="flex items-center gap-3 os-block px-3 py-2.5"
    >
      <div className="h-8 w-8 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 flex items-center justify-center text-sm font-mono text-[var(--accent)]">
        {handle.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-[var(--ink-1)]">@{handle}</div>
        <div className="text-[11px] text-[var(--ink-3)] font-mono">{status}</div>
      </div>
      <Users size={14} className="text-[var(--ink-3)]" />
    </Link>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="os-block p-4 text-center text-sm text-[var(--ink-3)]">
      {children}
    </div>
  );
}
