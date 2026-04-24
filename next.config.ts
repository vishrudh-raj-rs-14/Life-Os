import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep web-push as a native Node require() — never bundle it through Turbopack.
  // Without this, Turbopack evaluates the module at build time and throws
  // "No key set vapidDetails.publicKey" because VAPID env vars are absent then.
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
