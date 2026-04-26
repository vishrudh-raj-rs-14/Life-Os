#!/usr/bin/env node
/**
 * Push all variables from .env.local to Vercel **Production**, then `vercel deploy --prod`.
 *
 * Prerequisites:
 *   - `vercel login` (or VERCEL_TOKEN in the environment)
 *   - Linked project: `.vercel/project.json` (run `vercel link` in the repo if missing)
 *
 * Usage (from repo root):
 *   node scripts/push-vercel-env-and-deploy.cjs
 *
 * Sensitive heuristic: any name not starting with NEXT_PUBLIC_ that matches
 * SECRET|PASSWORD|PRIVATE|KEY|TOKEN|VAPID gets `vercel env add … --sensitive`.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function parseEnvFile(filePath) {
  const out = [];
  const text = fs.readFileSync(filePath, "utf8");
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const name = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out.push({ name, val });
  }
  return out;
}

function isSensitive(name) {
  if (name.startsWith("NEXT_PUBLIC_")) return false;
  return /SECRET|PASSWORD|PRIVATE|KEY|TOKEN|VAPID/i.test(name);
}

function main() {
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local at", envPath);
    process.exit(1);
  }

  const who = spawnSync("vercel", ["whoami"], { cwd: root, encoding: "utf8" });
  if (who.status !== 0) {
    console.error(who.stderr || who.stdout);
    console.error("\nRun: vercel login\nOr set VERCEL_TOKEN for non-interactive use.");
    process.exit(1);
  }

  const pairs = parseEnvFile(envPath);
  if (pairs.length === 0) {
    console.error("No KEY=value lines found in .env.local");
    process.exit(1);
  }

  for (const { name, val } of pairs) {
    const sensitive = isSensitive(name);
    const args = ["env", "add", name, "production", "--force"];
    if (sensitive) args.push("--sensitive");
    console.log("→", name, sensitive ? "(sensitive)" : "");
    const r = spawnSync("vercel", args, {
      cwd: root,
      input: val,
      encoding: "utf8",
      stdio: ["pipe", "inherit", "inherit"],
    });
    if (r.status !== 0) {
      console.error("Failed to set", name);
      process.exit(1);
    }
  }

  console.log("\nDeploying to production…");
  const d = spawnSync("vercel", ["deploy", "--prod"], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(d.status ?? 1);
}

main();
