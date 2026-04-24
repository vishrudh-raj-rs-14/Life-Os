"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/nav/BottomNav";
import { AppBoot } from "@/components/AppBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/transitions/PageTransition";
import { useUser } from "@/store/useUser";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter();
  const pathname    = usePathname();
  const { user, loading, load } = useUser();
  const checked     = useRef(false);

  // Single guard — runs once after mount
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    void (async () => {
      // 1. Must have a Supabase session (Google login)
      const sb = supabaseBrowser();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
      }

      // 2. Must have a local user profile (onboarding)
      await load();
      const repo = (await import("@/lib/repo")).getRepo;
      const u = await (await repo()).getUser();
      if (!u) {
        router.replace("/onboarding");
        return;
      }

      // All good — make sure Zustand is in sync
      if (!user) await load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !user) return null; // brief flicker guard

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
