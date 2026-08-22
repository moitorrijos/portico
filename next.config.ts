import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker runtime image: emits .next/standalone with a
  // self-contained server.js and only the traced runtime dependencies.
  output: "standalone",

  // Deliberate: the VPS is small (2-4GB) and runtime image optimization is
  // CPU/memory hungry -- sharp on glibc needs MALLOC_ARENA_MAX tuning to avoid
  // runaway memory. scripts/prep-images.ts pre-generates AVIF/WebP variants at
  // known dimensions instead, which hits the Lighthouse budget without the
  // runtime cost. See docs/DEPLOY.md.
  images: { unoptimized: true },

  // Surfaced in the demo banner and the /app footer so the deployed build is
  // always identifiable.
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.GIT_SHA ?? "dev",
  },
};

export default nextConfig;
