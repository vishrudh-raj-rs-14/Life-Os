"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/nav/BottomNav";
import { AppBoot } from "@/components/AppBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/transitions/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useUser } from "@/store/useUser";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter();
  const pathname    = usePathname();
  const { load }    = useUser();
  const checked     = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    void (async () => {
      const sb = supabaseBrowser();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (!data.session) { router.replace("/login"); return; }
      }
      await load();
      const repo = (await import("@/lib/repo")).getRepo;
      const u = await (await repo()).getUser();
      if (!u) { router.replace("/onboarding"); return; }
      await load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never return null here — that causes blank screens on every Zustand
  // re-render. Auth redirects handle unauthorised access; each page guards
  // its own empty/loading state.
  return (
    <div className="mx-auto w-full max-w-md safe-top">
      <PullToRefresh />
      <AppBoot />
      <main className="pb-32">
        {/* mode="sync" lets the incoming page fade in while the outgoing
            page fades out simultaneously — no empty gap between routes.    */}
        <AnimatePresence mode="sync" initial={false}>
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
