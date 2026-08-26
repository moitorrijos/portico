import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { decryptSession, getSessionCookie } from "@/lib/session";

/**
 * The data access layer's entry point.
 *
 * Spec §5: *"Every resident-facing query is scoped server-side by the caller's
 * active lease. Not filtered in the component — filtered in the data access
 * layer, so there is no code path that returns another resident's row."*
 *
 * The distinction this file exists to enforce: `proxy.ts` decides whether you
 * get a page at all, and does it optimistically from cookie presence alone.
 * This decides which *rows* you get, and does it from the database, on every
 * request. Next's own guidance is explicit that Proxy is not an authorization
 * boundary; the practical reason is that it runs before the request reaches
 * any of the code that knows what is being asked for.
 */

export type Session = {
  userId: string;
  role: "OWNER" | "STAFF" | "RESIDENT";
};

/**
 * The signed-in user, or `null`.
 *
 * Wrapped in React's `cache()`, so a single render that calls this from a
 * layout, a page and three components does one cookie decrypt and one database
 * read rather than five. The cache is per-request — there is no cross-request
 * leakage, which is the thing that would matter if it were memoized naively.
 *
 * It re-reads the user from the database rather than trusting the role in the
 * cookie. The cookie is authentic, but it is a snapshot: a user deleted or
 * demoted since it was minted still carries a perfectly valid token. This costs
 * one indexed primary-key lookup per request and removes a whole category of
 * stale-privilege bug.
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  const payload = await decryptSession(await getSessionCookie());
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true },
  });

  if (!user) return null;

  return { userId: user.id, role: user.role };
});

/**
 * The caller's active lease, which is the scope for every resident-facing read.
 *
 * Note what is absent: this takes no arguments. There is deliberately no way to
 * ask "the lease for unit X" from the resident surface, because the moment a
 * lease can be selected by parameter, a parameter can be tampered with. The
 * only lease a resident query can ever be scoped by is the one their own
 * session resolves to.
 */
export const getActiveLease = cache(async () => {
  const session = await verifySession();
  if (!session || session.role !== "RESIDENT") return null;

  return db.lease.findFirst({
    where: { residentId: session.userId, status: "ACTIVE" },
    select: { id: true, unitId: true, residentId: true, monthlyRent: true },
  });
});

/** True for OWNER and STAFF. Residents are never managers. */
export function isManager(session: Session | null): boolean {
  return session?.role === "OWNER" || session?.role === "STAFF";
}

/**
 * Guards for server actions and manager reads.
 *
 * These throw rather than returning null, because a caller that forgets to
 * check a returned value fails open — it carries on with `null` and reaches the
 * query anyway. A throw cannot be ignored by omission. Spec §5 asks for
 * "belt and braces" precisely so that a mistake in one layer is caught by
 * another rather than becoming a leak.
 */
export async function requireManager(): Promise<Session> {
  const session = await verifySession();
  if (!isManager(session)) throw new AuthorizationError("Manager role required");
  return session!;
}

export async function requireResident(): Promise<Session> {
  const session = await verifySession();
  if (session?.role !== "RESIDENT") {
    throw new AuthorizationError("Resident role required");
  }
  return session;
}

/**
 * Distinguishable from a programming error so a server action can map it to a
 * form error rather than a 500, without catching genuine bugs by accident.
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
