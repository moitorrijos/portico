/**
 * Stub for the `server-only` package.
 *
 * The real package is a build-time guard: its `default` export throws so that
 * importing a server module from a client bundle fails loudly. Vitest resolves
 * that `default` condition (there is no `react-server` condition outside a
 * Next build), so every DAL module would throw on import before a single test
 * ran.
 *
 * Aliasing it away is not weakening the guard. `server-only` protects the
 * client bundle, and these tests are not a client bundle -- they are Node
 * calling server functions directly, which is exactly the intended caller.
 * The guard still applies everywhere it is meant to; `next build` resolves the
 * real package and would still fail on a genuine client-side import.
 */
export {};
