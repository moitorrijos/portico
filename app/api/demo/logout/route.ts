import { seeOther } from "@/lib/http";
import { deleteSession } from "@/lib/session";

/**
 * Ends the demo session.
 *
 * POST for the same reason as the entry routes: a GET logout is a link that
 * anything can follow, and "why did I get signed out?" is a confusing thing to
 * debug when the answer is a prefetcher.
 */
export async function POST() {
  await deleteSession();
  // Relative Location -- see lib/http.ts for why request.url cannot be used.
  return seeOther("/");
}
