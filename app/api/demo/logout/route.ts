import { NextResponse, type NextRequest } from "next/server";

import { deleteSession } from "@/lib/session";

/**
 * Ends the demo session.
 *
 * POST for the same reason as the entry routes: a GET logout is a link that
 * anything can follow, and "why did I get signed out?" is a confusing thing to
 * debug when the answer is a prefetcher.
 */
export async function POST(request: NextRequest) {
  await deleteSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
