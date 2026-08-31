/**
 * The one place the test connection string is defined.
 *
 * It has to be importable from BOTH `vitest.config.ts` (which puts it in
 * `test.env` for the worker processes) and `tests/setup/global-setup.ts`
 * (which passes it to the migrate and seed child processes). Vitest runs
 * globalSetup in a separate module graph from the workers, so it does not see
 * `test.env` -- a value defined in the config alone reaches the tests and not
 * the setup, which fails as "DATABASE_URL is not set" at the least obvious
 * moment.
 *
 * `portico_test`, never `portico_dev`. The seed truncates every table before it
 * writes, so pointing this at a working database would destroy it on the next
 * `pnpm test`. That is also why this does not read `.env`.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://portico:devpassword@127.0.0.1:5433/portico_test?schema=public";

/** Fixed and deliberately public -- it signs tokens for a throwaway database.
 *  The suite mints tokens with a DIFFERENT key to prove they are rejected, so
 *  this value has to be knowable by the tests. */
export const TEST_SESSION_SECRET = "test-secret-do-not-use-outside-vitest";
