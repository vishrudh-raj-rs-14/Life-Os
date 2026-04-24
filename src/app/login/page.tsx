"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabaseBrowser, authRedirectUrl } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const client = supabaseBrowser();
    if (!client) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { error: err } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
    // On success, the browser navigates away — no need to setLoading(false)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-[var(--bg)]">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent), transparent)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8"
      >
        {/* Logo / wordmark */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-4"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            {/* Compound / Life OS icon — stylised 'L' */}
            <svg viewBox="0 0 32 32" width={32} height={32} fill="currentColor">
              <rect x="6" y="4" width="5" height="20" rx="2" />
              <rect x="6" y="20" width="16" height="5" rx="2" />
            </svg>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="serif text-3xl text-[var(--ink-1)]"
          >
            Life OS
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-[var(--ink-3)] mt-1"
          >
            Build the system. Become the person.
          </motion.p>
        </div>

        {/* Sign-in card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="w-full os-block p-6 flex flex-col gap-4"
        >
          <p className="text-xs font-mono text-[var(--ink-3)] uppercase tracking-widest text-center">
            Sign in to continue
          </p>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border border-[var(--border-strong)] bg-white text-gray-800 font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin text-gray-500" />
            ) : (
              /* Google "G" logo */
              <svg viewBox="0 0 24 24" width={18} height={18}>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {loading ? "Opening Google…" : "Continue with Google"}
          </button>

          {error && (
            <p className="text-xs text-[var(--danger)] text-center">{error}</p>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-[11px] text-[var(--ink-3)] text-center"
        >
          Your data lives on your device and in your private Supabase account.
          <br />
          No ads. No tracking.
        </motion.p>
      </motion.div>
    </div>
  );
}
