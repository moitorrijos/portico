import { NextResponse, type NextRequest } from "next/server";

import { isPubliclyIndexable } from "@/lib/indexing";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * Per-request edge/node hook (Next 16 renamed `middleware.ts` to `proxy.ts`).
 *
 * Intentionally thin. Per Next's own guidance, Proxy is NOT an authorization
 * boundary -- it does optimistic checks only. Real authorization lives in the
 * data access layer (lib/dal.ts) and inside each server action.
 *
 * Today it does two jobs: robots headers, and an OPTIMISTIC redirect of
 * anonymous traffic away from the private trees.
 *
 * "Optimistic" is load-bearing. It checks that a session cookie EXISTS. It does
 * not verify the signature, does not decode it, and never touches the database
 * -- a forged cookie containing the word "x" gets past this. That is fine and
 * intended: this is a redirect for humans who are not signed in, not a security
 * boundary. Real authorization is lib/dal.ts, which re-reads the user from the
 * database on every request. Verifying here as well would mean a database round
 * trip in front of every asset request for no additional safety.
 *
 * Why here and not `next.config.ts` headers()? Because `headers()` is compiled
 * into the build's routes manifest, so it cannot branch on a *runtime*
 * environment variable. Proxy runs per request, so APP_ENV is live.
 */

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

/** Route trees that are never indexable, in any environment. */
const PRIVATE_TREES = ["/app", "/portal"];

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Fail closed on both gates: the environment must be production AND the
  // content must have been declared ready (see lib/indexing.ts). Anything else
  // -- staging, a typo, an unset variable -- is marked noindex in its entirety.
  // Failing this direction hides a site that should be visible, which is
  // recoverable; failing the other way publishes one that should not be, which
  // is not. See docs/DEPLOY.md.
  const indexable = isPubliclyIndexable();

  const { pathname } = request.nextUrl;
  const isPrivate = PRIVATE_TREES.some(
    (tree) => pathname === tree || pathname.startsWith(`${tree}/`),
  );

  if (!indexable || isPrivate) {
    response.headers.set("X-Robots-Tag", NOINDEX);
  }

  // Cookie PRESENCE only -- see the note at the top of this file.
  if (isPrivate && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const home = new URL("/", request.url);
    // Preserve where they were going, so a link shared in a proposal lands on
    // the right screen after the visitor picks a persona.
    home.searchParams.set("from", pathname);
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Skip build assets; they don't need robots headers and this keeps the hook
  // off the hot path for static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
