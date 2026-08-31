import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { TEST_DATABASE_URL } from "./database-url.mjs";

/**
 * Brings the test database to a known state once, before any test file runs.
 *
 * This runs in a separate module graph from the test workers, so it cannot hand
 * anything to them through module state -- the connection string is passed to
 * the child processes explicitly, and the tests read it from `test.env` in
 * vitest.config.ts. Both must agree; they are the same default string.
 *
 * Seeding rather than hand-building fixtures is deliberate. The suite's claim
 * is about the data a visitor actually meets, so it should run against the data
 * a visitor actually meets -- 42 units, 32 leases and 25 requests of real
 * neighbours to be confused with, not two rows arranged to pass.
 */
export default async function setup(): Promise<void> {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, { cwd: root, env, stdio: "inherit" });

  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  run("pnpm", ["exec", "tsx", "scripts/seed.ts"]);
}
