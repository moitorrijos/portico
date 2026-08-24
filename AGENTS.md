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

History is squash-only; merged branches auto-delete.

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
- **`APP_ENV` fails closed.** Anything not exactly `production` is treated as staging and served `noindex`. A typo hides staging rather than exposing it, but a missing `APP_ENV=production` silently deindexes the real site.
- **Robots headers live in `proxy.ts`, not `next.config.ts` `headers()`.** The latter is compiled into the routes manifest and cannot branch on a runtime env var.
- **Never bake an environment into the image via `NEXT_PUBLIC_*`.** Those are inlined at build time and CI does not know a commit's destination. Use server-side `APP_URL`.
- **`proxy.ts` is not an authorization boundary.** Optimistic cookie checks only; real authorization lives in the data access layer and inside each server action.
- **Playfair Display is never used near a number in a column.** It has no tabular figures, so that is a structural limit rather than a preference. It also has a ~28px floor: below that its hairlines go muddy on the ivory.
- **The UI sans must have tabular figures.** Plus Jakarta Sans was chosen over Be Vietnam Pro for exactly this: Be Vietnam Pro has none at all (its `1` measures 12.3px against `4` at 22.7px at 32px, and `font-variant-numeric` has no effect), so ledger decimals never aligned. If the face is ever swapped again, measure before committing — do not assume, most faces have the feature but not all.
