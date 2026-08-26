/**
 * Prisma 7 configuration.
 *
 * The filename is not a preference — it is what `prisma init` emits for 7.10.0,
 * and the CLI looks for exactly this. Prisma 7 moved the datasource URL out of
 * `schema.prisma` into here; leaving `url` in the schema is a v6 habit that now
 * fails to parse.
 *
 * This file is REQUIRED at runtime, not just in development. `prisma migrate
 * deploy` refuses to run without it:
 *
 *   Error: The datasource.url property is required in your Prisma config file
 *          when using prisma migrate deploy
 *
 * — even with `DATABASE_URL` set in the environment and `--schema` passed
 * explicitly. That is why the Dockerfile copies it into the runtime image.
 *
 * ## Why there are no imports here
 *
 * The obvious version of this file starts with `import { defineConfig } from
 * "prisma/config"` and `import "dotenv/config"`, which is what `prisma init`
 * generates. Both are deliberately avoided:
 *
 * - `defineConfig` is an identity helper. Importing it would mean the config
 *   could only be loaded where `prisma` resolves from *this* directory — but in
 *   the runtime image the CLI lives in an isolated `prisma-cli/` tree, kept out
 *   of the app's own `node_modules` so its dependencies cannot shadow the ones
 *   Next traced into the standalone bundle.
 * - `dotenv` would be a production dependency existing solely to read one file
 *   in development. Node 24 has `process.loadEnvFile()` built in.
 *
 * Verified: `prisma migrate status` loads this file and resolves the datasource
 * with `DATABASE_URL` unset in the environment.
 */
try {
  // Development only. In production `DATABASE_URL` is injected by
  // `dokku postgres:link`, there is no .env file, and this throws — which is
  // the expected path, not an error worth reporting.
  process.loadEnvFile(".env");
} catch {
  // Intentionally empty.
}

const config = {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
};

export default config;
