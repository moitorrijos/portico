/**
 * Test double for `next/headers`.
 *
 * The real `cookies()` reads from an AsyncLocalStorage populated by Next's
 * request handler. There is no request here, so the DAL's session lookup would
 * throw before it could be tested at all.
 *
 * This replaces the store with a module-level one that tests drive directly.
 * The important property is that it is the ONLY thing the tests stub: the JWT
 * is signed and verified for real by `jose`, the session is decoded for real,
 * and every query runs against a real Postgres. What is faked is the transport
 * that carries the cookie, not any part of the decision being tested.
 */

type CookieEntry = { name: string; value: string };

let store = new Map<string, string>();

/** Signs the caller in as whoever this token represents. */
export function __setCookie(name: string, value: string): void {
  store.set(name, value);
}

/** Signs everyone out. Called between tests so no session leaks across them. */
export function __clearCookies(): void {
  store = new Map();
}

export function __getCookie(name: string): string | undefined {
  return store.get(name);
}

const cookieStore = {
  get(name: string): CookieEntry | undefined {
    const value = store.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string): void {
    store.set(name, value);
  },
  delete(name: string): void {
    store.delete(name);
  },
};

/** `await cookies()` works on a plain object; Next's own API is async too. */
export async function cookies() {
  return cookieStore;
}
