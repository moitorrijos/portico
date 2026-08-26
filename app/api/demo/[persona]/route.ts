import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { DEMO_PERSONAS, isDemoPersona } from "@/lib/demo-personas";
import { createSession } from "@/lib/session";

/**
 * One-click demo entry — spec §9: *"One click, no form, no signup. Never make a
 * prospect create an account to look at your work."*
 *
 * ## Why POST and not a link
 *
 * The spec calls these buttons and a "quieter link", which describes how they
 * look, not which HTTP method they use. Minting a session is a state change,
 * and a GET that changes state gets fired by things that were never asked to
 * fire it: link prefetchers, crawlers following hrefs, corporate link scanners
 * in email clients, and Next's own `<Link>` prefetch on hover. A prospect could
 * arrive already logged in as someone else's persona, or arrive to find their
 * session silently swapped because a preview bot touched the other button.
 *
 * They are rendered as `<form method="post">` with a submit button, which looks
 * identical and is honest about what it does.
 *
 * ## Why the persona is a slug, not an email
 *
 * `?email=` would make this an arbitrary session-minting endpoint — hand it any
 * address and it logs you in as that user. Only three fixed strings resolve;
 * everything else 404s without touching the database.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ persona: string }> },
) {
  const { persona } = await params;

  if (!isDemoPersona(persona)) {
    // 404 rather than 400: the set of valid personas is not a secret, but there
    // is no reason to help anyone enumerate what else might be accepted.
    return new NextResponse("Not found", { status: 404 });
  }

  const { email, landing } = DEMO_PERSONAS[persona];

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user) {
    // The demo accounts come from the seed. If they are missing, the database
    // has not been seeded — say so, because the alternative is a redirect into
    // an app that then behaves as though nobody is logged in.
    return new NextResponse(
      `Demo account ${email} not found. Has the database been seeded?`,
      { status: 503 },
    );
  }

  await createSession({ userId: user.id, role: user.role });

  // 303, not 302. After a POST, 303 tells the browser to follow with GET;
  // 302's behaviour here is historically ambiguous and some clients re-POST to
  // the target.
  return NextResponse.redirect(new URL(landing, request.url), 303);
}
