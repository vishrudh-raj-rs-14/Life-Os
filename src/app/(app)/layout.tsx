"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/nav/BottomNav";
import { AppBoot } from "@/components/AppBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/transitions/PageTransition";
import { useUser } from "@/store/useUser";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, loading, load } = useUser();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    let cancelled = false;
    (async () => {
      const repo = (await import("@/lib/repo")).getRepo;
      const u = await (await repo()).getUser();
      if (cancelled) return;
      if (!u) router.replace("/onboarding");
      else void load();
    })();
    return () => { cancelled = true; };
  }, [user, loading, router, load]);

  return (
    <div className="mx-auto w-full max-w-md min-h-[100dvh] flex flex-col safe-top">
      <AppBoot />
      <main className="flex-1 pb-32 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={pathname}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
