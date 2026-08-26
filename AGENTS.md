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
- **Playfair Display is never used near a number in a column.** It has no tabular figures, so that is a structural limit rather than a preference. It also has a ~28px floor: below that its hairlines go muddy on the ivory.
- **The UI sans must have tabular figures.** Plus Jakarta Sans was chosen over Be Vietnam Pro for exactly this: Be Vietnam Pro has none at all (its `1` measures 12.3px against `4` at 22.7px at 32px, and `font-variant-numeric` has no effect), so ledger decimals never aligned. If the face is ever swapped again, measure before committing — do not assume, most faces have the feature but not all.
