import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL, TEST_SESSION_SECRET } from "./tests/setup/database-url.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * The authorization suite runs against a real Postgres, not a mocked Prisma.
 *
 * Mocking the client here would test that the code passes the arguments we
 * expect it to pass -- which is the same assumption the code already encodes,
 * asserted twice. The claim being made is about which rows come back, and only
 * a database can answer that. A `where` clause that looks correct and silently
 * matches nothing, or matches everything because an `undefined` dropped a
 * condition, is exactly the failure a mock cannot see. That last one is not
 * hypothetical: lib/dal/documents.ts guards against it explicitly.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    // Serial. Every test drives one module-level cookie store and reads a
    // shared database; parallel workers would interleave sessions and produce
    // failures that depend on scheduling.
    fileParallelism: false,
    // Env is declared here rather than inherited from .env ON PURPOSE. The seed
    // TRUNCATES whatever DATABASE_URL points at, and a developer's .env points
    // at portico_dev. Inheriting it would mean `pnpm test` silently destroys
    // the database they were working in.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: TEST_SESSION_SECRET,
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      // Must come before "@/" or the more general prefix would swallow it.
      "next/headers": `${root}tests/stubs/next-headers.ts`,
      "server-only": `${root}tests/stubs/server-only.ts`,
      "@": root.replace(/\/$/, ""),
    },
  },
});
