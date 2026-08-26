import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The Prisma client singleton.
 *
 * Two things here are load-bearing and neither is obvious.
 *
 * **1. It is lazy.** `next build` runs in CI, in a Docker stage that has no
 * database and no `DATABASE_URL`. Anything that opens a connection at module
 * scope would therefore fail the build rather than the request — and it would
 * fail during "Collecting page data", which reports as an opaque prerender
 * error rather than as a missing environment variable. The Proxy below defers
 * every bit of that work to the first actual property access.
 *
 * **2. It is cached across hot reloads.** `next dev` re-evaluates modules on
 * every edit. Without stashing the instance on `globalThis`, each save leaks
 * another connection pool, and after a few minutes Postgres starts refusing
 * connections with a message about `max_connections` that has nothing
 * obviously to do with editing a file.
 *
 * Prisma 7 note: the driver adapter is not optional any more. There is no
 * built-in engine that reads `DATABASE_URL` on its own — the client's own
 * docblock shows `new PrismaClient({ adapter: new PrismaPg(...) })` as the
 * only supported construction.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Named explicitly, because the alternative is a driver-level error about
    // a malformed connection string that sends you looking at the URL's syntax
    // rather than at its absence.
    throw new Error(
      "DATABASE_URL is not set. It is injected by `dokku postgres:link` in " +
        "production and read from .env locally — see docs/SETUP-CHECKLIST.md " +
        "section E.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function getClient() {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Behaves exactly like a `PrismaClient`, but constructs nothing until the first
 * property is read. `db.user.findMany()` connects; importing `db` does not.
 */
export const db = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});
