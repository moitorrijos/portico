/**
 * The session cookie's name, and nothing else.
 *
 * Deliberately its own module with zero imports. `proxy.ts` needs this name to
 * do its optimistic presence check, but proxy runs in a separate, restricted
 * runtime — importing it from lib/session.ts would drag `server-only`,
 * `next/headers` and the whole of `jose` in with it, to read one string.
 *
 * A duplicated string literal in two files is the version of this that drifts
 * silently: rename it in one place and the proxy stops recognising sessions
 * while everything still compiles.
 */
export const SESSION_COOKIE_NAME = "portico_session";
