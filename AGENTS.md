<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

Everything above this line is generated and rewritten by `next dev`. Everything below is hand-maintained — keep additions here.

## Branching

`main` and `develop` are both **protected**: pull requests required, CI must pass, no direct pushes, no force-pushes, no deletions. Admin bypass is off, so these rules apply to everyone including the repo owner.

```
<type>/<short-kebab-description>        e.g. feat/design-tokens
                                             fix/ci-typecheck-missing-next-types
                                             docs/branching-and-commit-conventions
```

Flow: branch off `develop` → PR into `develop` → soak on staging → PR `develop` into `main` to release.

| Branch | Deploys to | Domain |
|---|---|---|
| `develop` | `portico-staging` | `portico-staging.frontendjuan.com` |
| `main` | `portico` | `portico.frontendjuan.com` |

Merged branches auto-delete. **Feature PRs squash; release PRs merge.**

`develop` → `main` is the one exception to squash-only, and it is deliberate.
Squashing a release would collapse every commit into one new SHA on `main`,
permanently diverging it from `develop` — so the next release PR replays the
same history and conflicts. A merge commit keeps `main` a true superset, which
makes every subsequent release a clean fast-forward.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/). The squash-merge title becomes the commit subject, so the PR title must also follow the format.

```
<type>(<optional scope>): <imperative summary, no trailing period>

<body: why, not what. Wrap at 72. State what was verified and how.>
```

Types: `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `test` · `build` · `ci` · `chore` · `revert`

Scopes worth using here: `ci`, `deploy`, `auth`, `dal`, `ui`, `charts`, `seed`, `manager`, `portal`, `marketing`, `config`.

## Verify before claiming

CI has already caught one works-on-my-machine failure: `pnpm typecheck` passed locally and failed on every Actions run, because `LayoutProps` is a generated global in `.next/types/` and `.next/` is gitignored. Local success is not evidence.

Before opening a PR:

```sh
pnpm lint
pnpm typecheck          # runs `next typegen` first -- needed on clean checkouts
pnpm build              # RSC boundaries and standalone output fail differently than dev
```

For anything touching the container or deploy path, build and run the image rather than reasoning about it:

```sh
docker build --build-arg GIT_SHA=localtest -t portico:localtest .
docker run -d --name portico-stg -e APP_ENV=staging -p 3401:3000 portico:localtest
```

See `docs/DEPLOY.md` for the full local verification recipe, and `docs/SETUP-CHECKLIST.md` for one-time infrastructure setup.

## Things that are load-bearing

- **`app/robots.ts` must keep `export const dynamic = "force-dynamic"`.** Without it the route is prerendered and the build-time `APP_ENV` gets baked in, which would ship a `Disallow: /` robots.txt to production.
- **Indexability has two gates, and `lib/indexing.ts` owns both.** `APP_ENV=production` *and* `ALLOW_INDEXING=true`. Anything else — staging, a typo, an unset variable — is served `noindex` everywhere. A typo hides a site that should be visible, which is recoverable; the other direction publishes one that should not be, which is not.
- **Never read `APP_ENV` for indexing decisions directly.** `proxy.ts` and `app/robots.ts` are two expressions of one policy, and when they disagree nothing fails — the header says one thing and `robots.txt` says another, silently. Both call `isPubliclyIndexable()` so drift is impossible rather than unlikely.
- **`proxy.ts` is optimistic and must stay optimistic.** It checks that a session cookie *exists* — no signature check, no decode, no database. A forged cookie containing the word `x` gets past it, and that is fine: it is a redirect for humans who are not signed in, not a boundary. Real authorization is `lib/dal.ts`, which re-reads the user from the database every request. Verifying in the proxy too would add a query in front of every request for no additional safety.
- **`proxy.ts` must not import from `lib/session.ts`.** It needs only the cookie's name, and that import would drag `server-only`, `next/headers` and the whole of `jose` into the proxy runtime. The name lives in `lib/session-cookie.ts`, a module with zero imports, shared by both — a duplicated string literal is the version that drifts silently, where a rename in one file stops the proxy recognising sessions while everything still compiles.
- **The authorization suite runs against a real Postgres, and must keep doing so.** A mocked Prisma would only assert that the code passes the arguments we already believe it passes. The claim is about which *rows* come back, and a `where` clause that silently matches everything — because an `undefined` dropped a condition — looks identical to a correct one from the outside. `pnpm test` migrates and seeds `portico_test` itself; CI gets a `postgres:18.4` service container in the same job.
- **`pnpm test` must never inherit `.env`.** The seed truncates every table before it writes, and a developer's `DATABASE_URL` points at `portico_dev`. `vitest.config.mts` declares `DATABASE_URL` and `SESSION_SECRET` explicitly in `test.env` for exactly this reason. The value lives in `tests/setup/database-url.mts` because **vitest runs `globalSetup` in a separate module graph from the test workers** — a connection string defined only in the config reaches the tests but not the setup, and fails as "DATABASE_URL is not set" at the least obvious moment.
- **`next/headers` is the only thing the suite stubs.** The JWT is signed and verified for real by `jose`, the session is decoded for real, every query hits a real database. What is faked is the transport that carries the cookie, not any part of the decision under test. `server-only` is aliased away too, but that is a client-bundle guard and these tests are not a client bundle.
- **The first `describe` block in `tests/authorization.test.ts` is a canary — do not delete it.** `verifySession` is wrapped in React's `cache()`. It happens not to memoize outside a request scope (no dispatcher, so it falls through), which is the only reason signing in as a different user between tests works at all. If that ever changes, every test after the first would silently run as the first test's session and pass vacuously. Those four tests are what makes the other twenty-four mean anything.
- **Every guard in this suite has been mutation-tested.** Dropping `internal: false` (both occurrences, independently), dropping `residentId` from `getResidentRequest`, dropping `leaseId` from `getResidentPayment`, making the documents UNIT branch unconditional, making `requireManager` stop checking the role, and trusting the cookie's role instead of the database — each produces a red test. If you add a guard here, break it on purpose and confirm something fails; a test that cannot fail is worse than no test, because it is believed.
- **Resident DAL functions take no id-of-the-caller parameter, ever.** `getResidentRequests()`, `getActiveLease()` and friends derive their scope from the session. The moment a resident id or lease id can be passed in, it can be tampered with. Ownership belongs *inside* the `where` clause — never fetch by id and then compare in JavaScript, which leaks the first time someone returns early on the wrong branch.
- **DAL reads return `null`, and the route calls `notFound()`.** Not the other way round. `notFound()` throws Next-specific control flow, which would make every one of these functions untestable outside a request context — and the authorization test suite is the entire point. Spec §5 requires **404, not 403**: a 403 confirms the record exists, which is what a stranger guessing ids is trying to learn.
- **DTOs in `lib/dto.ts` are hand-written, never derived with `Omit<>`.** A derived type silently acquires any field added to the schema later — which is precisely the moment a leak gets introduced and precisely the moment nobody is looking.
- **Route handlers must redirect with a RELATIVE `Location`, never `new URL(path, request.url)`.** The standalone server runs with `HOSTNAME=0.0.0.0` — it has to, or nginx could not reach it — and Next builds `request.url` from the address it bound to, **not** from the `Host` header. So the idiom the Next docs show resolves to `http://0.0.0.0:3000/app` and sends the visitor nowhere. It works perfectly in `next dev`, where the bind address is the host you typed, so it is invisible until it is in a container. Use `seeOther()` from `lib/http.ts`; `NextResponse.redirect()` cannot help because it rejects a bare path. **Redirects in `proxy.ts` are exempt** — Next normalises same-origin middleware redirects to relative paths already, verified.
- **Demo entry routes are POST, not GET.** Minting a session is a state change, and a GET that changes state gets fired by link prefetchers, crawlers, email link-scanners and Next's own `<Link>` prefetch-on-hover. They render as `<form method="post">` and look identical. Verified: `GET /api/demo/manager` returns **405**.
- **Prisma is pinned to 7.10.0, and must stay pinned.** The `prisma` CLI's `latest` dist-tag on npm currently points at **`8.0.0-rc.12`**, a release candidate, while `@prisma/client`'s `latest` is the stable `7.10.0`. So `pnpm add prisma` silently pairs an RC CLI with a stable client, and `prisma migrate` prints an upgrade banner urging exactly that. Pin both; do not bump to latest without checking the dist-tags.
- **Prisma 7 is not Prisma 6.** Four things changed that break v6 muscle memory: the generator is `prisma-client` (not `prisma-client-js`) and `output` is required; the datasource URL moved out of `schema.prisma` into `prisma7.config.ts`; a **driver adapter is mandatory** (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`) — there is no built-in engine that reads `DATABASE_URL`; and `migrate dev` no longer generates the client, so `prisma generate` is its own step. It is wired into `build` and `typecheck` because the client is gitignored and every clean checkout needs it.
- **`prisma7.config.ts` is required at runtime and imports nothing.** `migrate deploy` refuses to run without it, even with `DATABASE_URL` set and `--schema` passed. It deliberately avoids `import { defineConfig } from "prisma/config"` so it can be loaded while the CLI lives in an isolated `prisma-cli/` tree, and uses Node 24's `process.loadEnvFile()` rather than a `dotenv` dependency that would exist solely to read one file in development.
- **`db` in `lib/db.ts` is a lazy Proxy, and must stay one.** `next build` runs with no database — in CI and in the Docker builder stage. Anything that connects at module scope fails the build during "Collecting page data", which reports as an opaque prerender error rather than a missing env var. Verified with `env -u DATABASE_URL pnpm build`.
- **The Prisma CLI cannot be copied out of the builder stage.** pnpm's `node_modules` is a symlink farm into `.pnpm`, and `COPY --from` copies the link, not its target. A separate stage installs it with **npm** (which produces a real tree) into `prisma-cli/`, kept outside the app's `node_modules` so its transitive dependencies cannot shadow the ones Next traced. It needs `--chown`: Prisma writes into `@prisma/engines` at startup and the app runs as uid 1001.
- **Migrations still use a native binary.** Prisma 7 removed the Rust *query* engine, but `@prisma/engines` ships a ~28MB `schema-engine-linux-<arch>-openssl-<ver>` that `migrate deploy` shells out to. It is glibc-linked with the OpenSSL version in its filename — which is the actual reason this image is Debian and not Alpine.
- **`app.json` must be `COPY`ed into the image explicitly.** Dokku reads it *out of the image* at `WORKDIR/app.json`, never from the repo — with `git:from-image` the repo is never on the server at all. Nothing imports `app.json`, so standalone output tracing omits it, and Dokku then proceeds silently. The only hint is one grey line in the deploy log: `No healthchecks found in app.json for web process type`. In Phase 1 this is the difference between `prisma migrate deploy` running and the app starting against an unmigrated database.
- **`git:from-image` is not idempotent.** Re-deploying an image the app already points at exits 1 with `No changes detected, skipping git commit`. The deploy step falls back to `ps:rebuild` for exactly this case, because the first deploy of any new app fails its TLS check and must be re-runnable.
- **`ALLOW_INDEXING` is unset on production on purpose.** The live domain currently serves a placeholder; a placeholder indexed under the real domain is worse than no listing. Set it when the Phase 4 marketing site ships — `dokku config:set portico ALLOW_INDEXING=true` — and the deploy workflow, which reads that same variable off the app, will flip its assertion with it.
- **Robots headers live in `proxy.ts`, not `next.config.ts` `headers()`.** The latter is compiled into the routes manifest and cannot branch on a runtime env var.
- **Never bake an environment into the image via `NEXT_PUBLIC_*`.** Those are inlined at build time and CI does not know a commit's destination. Use server-side `APP_URL`.
- **`proxy.ts` is not an authorization boundary.** Optimistic cookie checks only; real authorization lives in the data access layer and inside each server action.
- **Manager table filters and sort live in the URL, not in client state.** That is what keeps `/app/units` a server component: a filtered, sorted view can be pasted to a colleague, survives reload and back/forward, and renders before any JavaScript has run. `SortableTh` takes an `href` for this; the button-and-`onSort` form is only for tables with no URL to write to. The one client component on the page is the filter row, and all it adds is auto-submit on change.
- **Validate every search param against a known set before it reaches Prisma.** An unrecognised sort key would silently fall back while the header showed no active column, and an unrecognised status reaches Prisma as an invalid enum and 500s on a URL anyone can type.
- **Nothing may call `Date.now()` during render.** React's compiler rejects it as impure, and it is right to: the value differs between the server pass and any client re-render, and flips at midnight. Anything time-relative -- `daysLate`, `daysVacant` -- is computed in the DAL and arrives as a number.
- **Zero bedrooms is a studio, and must render as one.** The seed deliberately includes three. A bare `0` in a "Beds" column reads as missing data rather than as a unit type, and a rent roll with holes in it is the fastest way to make seeded data look broken. `formatBedrooms` in `lib/format.ts`.
- **Empty units carry a previous tenancy.** Without an ENDED lease the unit detail's vacant view answers all three of its questions with "never" -- three empty states side by side, which reads as missing data rather than as an available apartment. Two units are left with no history on purpose, because a never-let unit is a real case the screen must handle. Voids run one to four months: much longer says something is wrong with the apartment, which is not the story a portfolio at 76% occupancy tells.
- **Charts are hand-rolled SVG with a fixed `viewBox`, rendered on the server.** A charting library needs a client component and a DOM measurement pass before it can draw, which is a spinner on the most important screen in the app. The trade is that strokes scale with the box, so every mark carries `vectorEffect="non-scaling-stroke"`. Only `CrosshairLayer` is a client component — it ships the pointer maths and nothing else.
- **Every chart must be wrapped in `ChartFrame`, and the table view is not optional.** The sequential ramp's light end measures 2.36:1 on the ivory — above §8's 2:1 floor for a mark but below 3:1, which obligates a non-colour route to every value. The table IS that route. It also supplies the `<figure>`/`<figcaption>` semantics and keeps single-series charts from growing a legend that would just restate the title.
- **Bars are never coloured by rank.** It is tempting to run the sequential ramp across the occupancy bars, darkest for the fullest community. That encodes rank, so the moment a filter reorders them the survivors get repainted and a colour that meant "Arbor Row" now means "The Mercer". One hue; length carries the magnitude.
- **The sparkline scales to its own range; the twelve-month chart is zero-based.** Deliberately different. Anchoring the sparkline at zero squeezed a 44k–55k series into the top fifth of a 28px box and it read as a broken chart. A sparkline is shape — the tile's value states the level, and the honest magnitude lives in the axed chart below it with its table view.
- **`niceMax` rounds the tick interval, not the maximum.** Rounding the maximum snapped a series peaking at 55k to a 100k axis, so the data used the bottom half of the plot and looked like it was flatlining.
- **The hero occupancy figure is the one place Playfair appears inside the app**, and there is exactly one per view. General dataviz guidance says a hero figure should never use a serif; the approved plan overrides that here because Playfair *is* this project's editorial voice, and §8 already specifies proportional (not tabular) figures at that size, which is the condition that makes a serif legible there.
- **`PAID` / `LATE` / `DUE` are three distinct things, and conflating two of them is a real bug that shipped.** LATE means *paid after the due date* — it carries a `paidAt` and the money has arrived. DUE means genuinely outstanding, with `paidAt: null`. The overdue query must filter on `paidAt: null` and a past `dueDate`, never on `status: "LATE"`; doing the latter reported rent settled eighteen months ago as "548 days late". For the same reason, "collected" counts `paidAt !== null`, not `status === "PAID"`, or every month is understated by its late payments and the collection meter sits permanently red.
- **Arrears age out of the seed.** A flat percentage of never-paid rent across eighteen months leaves debt from early last year sitting in the dashboard. Only the last three months carry anything outstanding, and `paidAt` is capped at the run date — rent cannot have been received in the future.
- **Playfair Display is never used near a number in a column.** It has no tabular figures, so that is a structural limit rather than a preference. It also has a ~28px floor: below that its hairlines go muddy on the ivory.
- **The UI sans must have tabular figures.** Plus Jakarta Sans was chosen over Be Vietnam Pro for exactly this: Be Vietnam Pro has none at all (its `1` measures 12.3px against `4` at 22.7px at 32px, and `font-variant-numeric` has no effect), so ledger decimals never aligned. If the face is ever swapped again, measure before committing — do not assume, most faces have the feature but not all.

- **The seed ships as a pre-bundled `.mjs`, not as TypeScript plus `tsx`.** The standalone output contains **no `@prisma` packages at all** — Next compiles the client into its own server bundle — so a source script inside the container has nothing to import. `build:scripts` bundles `scripts/seed.ts` with esbuild into `dist-scripts/seed.mjs`, and three flags are load-bearing: `--format=esm` (CJS output dies on `import.meta.url` being undefined), the `createRequire` banner (`pg` is CommonJS and dynamically requires node builtins, which a plain ESM bundle rejects with `Dynamic require of "events" is not supported`), and `--external:pg-native` (an optional native dependency that is not installed). Run it in production with `dokku run <app> node dist-scripts/seed.mjs`.
- **`build:scripts` is chained into `build`, so the bundle is always current.** `dist-scripts/` is gitignored — the image builds it rather than carrying a committed artifact that could go stale against the schema.
- **ESLint's flat config does not read `.gitignore`.** Gitignoring `dist-scripts/` was not enough to keep a 5MB bundle with every dependency inlined out of the lint run; it needs its own entry in `globalIgnores`. Anything generated and gitignored needs the same treatment or it will bury real findings under vendored ones.
- **The demo persona emails are a contract between two files.** `lib/demo-personas.ts` (what the entry routes look up) and `lib/demo-data/catalogue.ts` (what the seed writes) must agree exactly, or a prospect's click produces a 503 at the worst possible moment. The seed asserts they match **before it writes anything**, so the failure is a clear message at seed time rather than a dead button in production.
- **`lib/demo-personas.ts` is deliberately not `server-only`.** It holds three labels, three landing paths and three seeded addresses — no secrets. The seed script runs outside Next entirely and imports it; `server-only` breaks that and buys nothing.
- **The seed truncates before it writes, and all its randomness comes from one seeded PRNG.** `DEMO_SEED` drives a mulberry32 in `lib/demo-data/rng.ts`, so names, amounts, statuses and counts are identical on every machine and every run — which is what makes re-running safe and keeps screenshots valid. Never reach for `Math.random()`; route it through `rng` so the demo stays reproducible.
- **Dates are deliberately relative to the run date, and must stay that way.** Leases, payments, requests and announcements are all anchored to `new Date()` — `monthsAgo(n)`, `addDays(new Date(), -n)`. That is the one axis the PRNG intentionally does not fix: the demo resets nightly, and hard-coded dates would have a prospect looking at rent "due" months in the past. Reproducible *shape*, current *dates* — pinning the dates to make the seed byte-identical would trade a real property for a cosmetic one.
- **Occupancy is a hero figure, so the seed's unit count is a design decision.** An early pass created 102 units against ~30 residents and produced **31% occupancy** — a dashboard whose headline number reads as a failing business. It is 42 units at 76% now. The community descriptions state their own unit counts, so those must be edited whenever the counts change: prose that disagrees with the table is the detail that tells a visitor the data is fake.
