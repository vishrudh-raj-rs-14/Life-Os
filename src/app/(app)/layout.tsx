"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/nav/BottomNav";
import { AppBoot } from "@/components/AppBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PageTransition } from "@/components/transitions/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useUser } from "@/store/useUser";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { load, user } = useUser();
  const checked  = useRef(false);

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

  useEffect(() => {
    if (!user) return;
    const done =
      user.adherence?.commitmentCompletedAt != null || user.adherence?.commitmentSkipped;
    if (done) return;
    if (pathname === "/commitment") return;
    router.replace("/commitment");
  }, [user, pathname, router]);

  return (
    <div className="mx-auto w-full max-w-md safe-top">
      <PullToRefresh />
      <AppBoot />
      {/* PageTransition wraps each page with a simple fade-in.
          We do NOT use AnimatePresence here — simultaneous rendering of the
          old+new page in normal document flow pushed new pages off-screen. */}
      <main className="pb-32">
        <PageTransition key={pathname}>
          {children}
        </PageTransition>
      </main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
