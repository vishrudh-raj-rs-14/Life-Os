"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/nav/BottomNav";
import { AppBoot } from "@/components/AppBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useUser } from "@/store/useUser";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, load } = useUser();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    // double-check Dexie directly before bouncing — the in-memory store can lag
    // behind a freshly seeded user (e.g. straight after onboarding).
    let cancelled = false;
    (async () => {
      const repo = (await import("@/lib/repo")).getRepo;
      const u = await (await repo()).getUser();
      if (cancelled) return;
      if (!u) router.replace("/onboarding");
      else void load();
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, load]);

  return (
    <div className="mx-auto w-full max-w-md min-h-[100dvh] flex flex-col safe-top">
      <AppBoot />
      <main className="flex-1 pb-32">{children}</main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
