import { NextResponse, type NextRequest } from "next/server";

import { isPubliclyIndexable } from "@/lib/indexing";

/**
 * Per-request edge/node hook (Next 16 renamed `middleware.ts` to `proxy.ts`).
 *
 * Intentionally thin. Per Next's own guidance, Proxy is NOT an authorization
 * boundary -- it does optimistic checks only. Real authorization lives in the
 * data access layer (lib/dal.ts) and inside each server action.
 *
 * Today it does one job: robots headers.
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

  return response;
}

export const config = {
  // Skip build assets; they don't need robots headers and this keeps the hook
  // off the hot path for static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
