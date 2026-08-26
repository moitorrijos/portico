import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { Role } from "@/lib/generated/prisma/enums";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * Hand-rolled `jose`-signed session cookie.
 *
 * This is the architecture Next's own bundled auth guide demonstrates
 * (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`), not a
 * shortcut around a library. Auth.js is a reasonable alternative for an app
 * with OAuth providers, email verification and password resets; this one has
 * three fixed demo accounts and none of those things, so a library would add a
 * provider/callback layer whose documented patterns predate Next 16's
 * `middleware.ts` -> `proxy.ts` rename, in exchange for nothing.
 *
 * What the cookie is NOT: an authorization decision. It says who is asking.
 * Whether they may see a given row is decided in lib/dal.ts, per request,
 * against the database.
 */

const COOKIE_NAME = SESSION_COOKIE_NAME;

/** Seven days. Long enough that a prospect can come back to the tab tomorrow. */
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionPayload = {
  userId: string;
  role: Role;
};

/**
 * Read at call time, not at module scope.
 *
 * At module scope this would run during `next build` — where `SESSION_SECRET`
 * is deliberately absent, because the image is built once in CI and deployed to
 * two environments that each hold their own secret. Baking one in would make a
 * staging cookie valid in production, which is precisely what giving each app
 * its own secret is meant to prevent.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with `openssl rand -base64 32`; " +
        "each environment needs its own. See docs/SETUP-CHECKLIST.md section E.",
    );
  }

  return new TextEncoder().encode(secret);
}

/** Signs a payload. Exported for the tests; routes should use `createSession`. */
export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_DURATION_MS))
    .sign(getSecretKey());
}

/**
 * Verifies and decodes. Returns `null` for anything untrustworthy — expired,
 * tampered, signed with another environment's secret, or simply absent.
 *
 * It never throws and never distinguishes between those cases to the caller.
 * A "your token expired" versus "your signature is invalid" distinction is a
 * free oracle for anyone probing, and there is no legitimate caller that needs
 * to tell them apart: every one of them redirects to the same place.
 */
export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    // Re-validate the shape. A payload that verifies is authentic, but "signed
    // by us" is not the same as "structurally what we expect" — an older
    // format, or a token minted before a field existed, would sail through
    // signature verification and then produce `undefined` where a user id was
    // assumed.
    const { userId, role } = payload as Partial<SessionPayload>;
    if (typeof userId !== "string" || typeof role !== "string") return null;

    return { userId, role: role as Role };
  } catch {
    return null;
  }
}

/** Mints a session and sets the cookie. Called only by the demo-entry routes. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    // No JavaScript, anywhere, ever needs to read this. httpOnly means an XSS
    // bug cannot exfiltrate the session.
    httpOnly: true,
    // In development the app is served over plain http on localhost, where a
    // `secure` cookie is simply discarded — and the failure looks like "login
    // does nothing" rather than "cookie rejected".
    secure: process.env.NODE_ENV === "production",
    // `lax`, not `strict`: the demo entry points are POSTed from the marketing
    // pages and links arrive from proposals and portfolios. `strict` would drop
    // the cookie on those first cross-site navigations, so a prospect clicking
    // through from an email would land logged out.
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
}

/** Reads the raw cookie. Prefer `verifySession()` in lib/dal.ts. */
export async function getSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
