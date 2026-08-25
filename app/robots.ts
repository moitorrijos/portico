import type { MetadataRoute } from "next";

import { isPubliclyIndexable } from "@/lib/indexing";

/**
 * MUST be request-time. `robots.ts` is a Route Handler that Next caches and
 * prerenders by default -- without this, the build-time value of APP_ENV would
 * be baked into the output. Since the image is built in CI before it knows
 * which environment it is deploying to, that would publish the wrong rules:
 * either a disallow-all robots.txt on production, or an indexable staging.
 */
export const dynamic = "force-dynamic";

/**
 * Named AI/LLM crawlers. `User-agent: *` already covers compliant bots, but
 * several of these only honour their own token, so they are listed explicitly.
 * Note this is advisory only -- HTTP basic auth on the staging Dokku app is the
 * layer that actually enforces it. See docs/SETUP-CHECKLIST.md section L.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "CCBot",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "YouBot",
  "AI2Bot",
  "Timpibot",
  "Omgilibot",
];

export default function robots(): MetadataRoute.Robots {
  // Staging, and production before launch: nothing is crawlable, by anyone.
  // Same single policy the X-Robots-Tag header uses, so the two cannot drift.
  if (!isPubliclyIndexable()) {
    return {
      rules: [
        { userAgent: "*", disallow: "/" },
        { userAgent: AI_CRAWLERS, disallow: "/" },
      ],
    };
  }

  // Launched production: the marketing pages are the indexable surface. The
  // authenticated trees are not, and are additionally covered by the
  // X-Robots-Tag header set in proxy.ts.
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/portal/", "/api/"],
      },
    ],
    // Sitemap is added in Phase 4 alongside app/sitemap.ts -- pointing at a
    // 404 now would be worse than omitting it.
  };
}
