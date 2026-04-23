"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { Crown, Plus, Swords, Users } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useUser } from "@/store/useUser";
import { LOCAL_USER_ID, fmtMinutes } from "@/lib/utils";
import { startOfWeek } from "date-fns";
import { weekMinutes } from "@/lib/engine";

function makeInviteCode(): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export default function SquadPage() {
  const { user } = useUser();
  const squads = useLiveQuery(() => db().squads.toArray(), []);
  const members = useLiveQuery(() => db().squadMembers.toArray(), []);
  const sessions = useLiveQuery(
    () => db().sessions.filter((s) => !s.deletedAt).toArray(),
    []
  );
  const goals = useLiveQuery(
    () => db().goals.filter((g) => !g.archived && !g.deletedAt).toArray(),
    []
  );
  const feed = useLiveQuery(
    () => db().feed.orderBy("createdAt").reverse().limit(20).toArray(),
    []
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  if (!user) return null;

  const mine = (squads ?? []).filter((s) =>
    (members ?? []).some((m) => m.squadId === s.id && m.userId === LOCAL_USER_ID)
  );
  const activeSquad = mine[0];

  async function create() {
    if (!name.trim()) return;
    const id = nanoid();
    const code = makeInviteCode();
    await db().squads.put({
      id,
      name: name.trim(),
      inviteCode: code,
      ownerId: LOCAL_USER_ID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db().squadMembers.put({
      id: nanoid(),
      squadId: id,
      userId: LOCAL_USER_ID,
      role: "owner",
      joinedAt: Date.now(),
    });
    setName("");
    setOpenCreate(false);
  }

  async function join() {
    const code = joinCode.trim().toUpperCase();
    const sq = (squads ?? []).find((s) => s.inviteCode === code);
    if (!sq) {
      alert("No squad with that code (locally).");
      return;
    }
    await db().squadMembers.put({
      id: nanoid(),
      squadId: sq.id,
      userId: LOCAL_USER_ID,
      role: "member",
      joinedAt: Date.now(),
    });
    setJoinCode("");
    setOpenJoin(false);
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const myWeek = (goals ?? []).reduce(
    (a, g) => a + weekMinutes(sessions ?? [], g.id, weekStart),
    0
  );

  const squadMembers = activeSquad
    ? (members ?? []).filter((m) => m.squadId === activeSquad.id)
    : [];

  return (
    <div className="px-5 pt-6 pb-10 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="os-label">Accountability</div>
          <h1 className="serif text-3xl text-[var(--ink-1)]">Squad</h1>
        </div>
        {!activeSquad && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpenJoin(true)}>
              Join
            </Button>
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus size={14} /> Create
            </Button>
          </div>
        )}
      </div>

      {!activeSquad ? (
        <EmptyHero onCreate={() => setOpenCreate(true)} onJoin={() => setOpenJoin(true)} />
      ) : (
        <>
          <div className="os-block-strong p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-2)]">
                <Users size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="serif text-xl text-[var(--ink-1)] truncate">{activeSquad.name}</div>
                <div className="text-[11px] text-[var(--ink-3)] font-mono mt-0.5">
                  code{" "}
                  <span className="text-[var(--ink-2)]">{activeSquad.inviteCode}</span>{" "}
                  · {squadMembers.length} member{squadMembers.length === 1 ? "" : "s"}
                </div>
              </div>
              {activeSquad.ownerId === LOCAL_USER_ID && (
                <Crown size={16} className="text-[var(--accent)]" />
              )}
            </div>
          </div>

          <Section title="Weekly leaderboard">
            <div className="space-y-1.5">
              {/* In local-only mode, only the user appears */}
              <Row
                rank={1}
                handle={user.handle}
                value={fmtMinutes(myWeek)}
                you
              />
              {squadMembers
                .filter((m) => m.userId !== LOCAL_USER_ID)
                .map((m, i) => (
                  <Row
                    key={m.id}
                    rank={i + 2}
                    handle={m.userId}
                    value={"—"}
                  />
                ))}
            </div>
          </Section>

          <Section title="Active duels">
            <DuelsList />
          </Section>

          <Section title="Feed">
            {feed && feed.length > 0 ? (
              <div className="space-y-1.5">
                {feed.map((e) => (
                  <div key={e.id} className="os-block p-3 text-sm">
                    <div className="text-[var(--ink-1)]">
                      {(e.payload as { text?: string }).text ?? e.type}
                    </div>
                    <div className="text-[11px] text-[var(--ink-3)] font-mono mt-0.5">
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Quiet so far. Complete a quest to write the first chapter.</Empty>
            )}
          </Section>
        </>
      )}

      <Sheet open={openCreate} onClose={() => setOpenCreate(false)} title="Create squad">
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              autoFocus
              placeholder="The Compounders"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button size="lg" className="w-full" onClick={create}>
            Create & invite
          </Button>
        </div>
      </Sheet>

      <Sheet open={openJoin} onClose={() => setOpenJoin(false)} title="Join squad">
        <div className="space-y-4">
          <div>
            <Label>Invite code</Label>
            <Input
              autoFocus
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
          <Button size="lg" className="w-full" onClick={join}>
            Join
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function DuelsList() {
  const duels = useLiveQuery(() => db().duels.toArray(), []);
  if (!duels || duels.length === 0)
    return <Empty>No active duels. Challenge a friend.</Empty>;
  return (
    <div className="space-y-1.5">
      {duels.map((d) => (
        <div key={d.id} className="os-block p-3">
          <div className="flex items-center gap-2 text-sm text-[var(--ink-1)]">
            <Swords size={14} className="text-[var(--danger)]" />
            <span className="font-medium capitalize">{d.category}</span>
            <span className="text-[var(--ink-3)]">· {d.metric}</span>
          </div>
          <div className="text-[11px] text-[var(--ink-3)] font-mono mt-0.5">
            ends {new Date(d.endsAt).toLocaleDateString()}
          </div>
        </div>
      ))}
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
      {children}
    </div>
  );
}

function Row({
  rank,
  handle,
  value,
  you,
}: {
  rank: number;
  handle: string;
  value: string;
  you?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-md border p-3 ${
        you
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="w-6 text-center text-sm font-mono text-[var(--ink-3)]">
        {String(rank).padStart(2, "0")}
      </div>
      <div className="h-8 w-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center text-xs font-mono text-[var(--ink-2)]">
        {handle.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 truncate text-sm text-[var(--ink-1)]">
        @{handle}{" "}
        {you && (
          <span className="text-[var(--accent)] text-[10px] font-mono ml-1">
            you
          </span>
        )}
      </div>
      <div className="text-sm font-semibold tabular-nums text-[var(--ink-1)]">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="os-block p-4 text-center text-sm text-[var(--ink-3)]">
      {children}
    </div>
  );
}

function EmptyHero({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="os-block-strong p-6 text-center">
      <div className="h-14 w-14 mx-auto rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] flex items-center justify-center mb-3 text-[var(--ink-2)]">
        <Users size={24} />
      </div>
      <h2 className="serif text-2xl text-[var(--ink-1)]">
        You compound faster with people.
      </h2>
      <p className="text-sm text-[var(--ink-3)] mt-2 mb-4 max-w-sm mx-auto">
        Squads are private groups of up to 8. Weekly leaderboards, duels, and
        quiet accountability.
      </p>
      <div className="flex gap-2 justify-center">
        <Button onClick={onJoin} variant="secondary">
          Join with code
        </Button>
        <Button onClick={onCreate}>
          <Plus size={14} /> Create squad
        </Button>
      </div>
    </div>
  );
}
