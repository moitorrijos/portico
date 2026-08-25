/**
 * Whether this deployment's public surface may be indexed by search engines.
 *
 * TWO gates, both of which must pass, and both of which fail closed:
 *
 *   APP_ENV=production    the environment is the real one
 *   ALLOW_INDEXING=true   ...and we have decided the content is worth finding
 *
 * The second gate exists because "deployed to production" and "ready to appear
 * in Google" are different events. The marketing site is Phase 4; until then
 * the live domain serves a placeholder, and a placeholder indexed under the
 * real domain is worse than no listing at all -- search engines cache it, and
 * the first impression a prospect gets from a search result is one you do not
 * control the timing of.
 *
 * Both proxy.ts and app/robots.ts read this single function on purpose. They
 * are two expressions of one policy, and when they disagree the disagreement
 * is silent: the header says one thing, robots.txt says another, and nothing
 * fails. A shared helper makes drift impossible rather than unlikely.
 *
 * To launch: `dokku config:set portico ALLOW_INDEXING=true`. The deploy
 * workflow reads that same variable off the app to decide what to assert, so
 * there is no second place to remember.
 */
export function isPubliclyIndexable(): boolean {
  return (
    process.env.APP_ENV === "production" &&
    process.env.ALLOW_INDEXING === "true"
  );
}
