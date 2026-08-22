// Target for Dokku's startup healthcheck (see app.json). Must never be
// statically cached, or the check would pass against a stale prerender.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    sha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
  });
}
