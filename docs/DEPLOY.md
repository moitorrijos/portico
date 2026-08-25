# Deploying Pórtico

One-time infrastructure setup lives in **[SETUP-CHECKLIST.md](./SETUP-CHECKLIST.md)**. This document covers the pipeline itself and the changes each future phase needs.

---

## Environments

| Branch | Dokku app | Domain | `APP_ENV` | Indexable |
|---|---|---|---|---|
| `main` | `portico` | `portico.frontendjuan.com` | `production` | Marketing yes; `/app` + `/portal` no |
| `develop` | `portico-staging` | `portico-staging.frontendjuan.com` | `staging` | **Nothing.** Search and AI crawlers blocked |
| PRs | — | — | — | Builds only, never deploys |

Both apps run on the same VPS with **separate Postgres services** and separate storage mounts. Staging is never wired to production data.

Suggested flow: feature branch → PR into `develop` → staging soak → PR `develop` into `main`.

---

## How a deploy happens

```
push
 └─ .github/workflows/deploy.yml
     ├─ check:  install → lint → typecheck → test (--if-present)
     ├─ build:  docker build → push ghcr.io/<owner>/portico:<sha>
     ├─ deploy-staging      [develop only] → portico-staging  → verify noindex
     └─ deploy-production   [main only]    → portico          → verify indexability
```

The VPS never compiles anything — `next build` is memory-hungry and CPU-hungry, and the box has 4 GB and 2 *shared* vCPUs to run two apps and two databases on. GitHub Actions builds, GHCR stores, Dokku pulls. Deploys take seconds and a broken build never reaches production.

### The image is environment-agnostic, on purpose

Staging and production run **the same artifact**, differing only in Dokku config (`APP_ENV`, `DATABASE_URL`, domain). That is what makes staging a real rehearsal rather than a look-alike, and it means a green staging deploy is meaningful evidence about production.

The consequence to respect: **never bake an environment into the image.** `NEXT_PUBLIC_*` variables are inlined at build time, and CI does not know which environment a commit is destined for. So the canonical URL is a *server-side* `APP_URL`, not `NEXT_PUBLIC_APP_URL`. If a client component needs it, read it in a server component and pass it down.

### Required secrets

| Secret | Purpose |
|---|---|
| `DOKKU_HOST` | VPS IP or hostname — shared by both environments |
| `DOKKU_SSH_PRIVATE_KEY` | CI-only ed25519 key, registered via `dokku ssh-keys:add github-actions` |
| `STAGING_BASIC_AUTH` | Optional, `user:password`. Needed only if staging is behind `dokku http-auth`, so the post-deploy checks can read past the 401 |

Pushing to GHCR uses the built-in `GITHUB_TOKEN` (`permissions: packages: write`) — no PAT needed.

Both jobs use GitHub **Environments** (`staging`, `production`), so you can add manual approval or branch restrictions to production later without touching the workflow.

---

## Keeping staging out of search and AI crawlers

Three layers, because the first two are advisory and the third is not.

**1. `X-Robots-Tag` header — `proxy.ts`.** Sets `noindex, nofollow, noarchive, nosnippet, noimageindex`. In staging it applies to *every* route; in production only to `/app` and `/portal`.

This lives in `proxy.ts` rather than `next.config.ts` `headers()` for a specific reason: `headers()` is compiled into the build's routes manifest, so it cannot branch on a *runtime* environment variable. Proxy runs per request, so `APP_ENV` is live.

**2. `robots.txt` — `app/robots.ts`.** Staging returns `Disallow: /` for `*` plus 23 named AI/LLM user-agents that only honour their own token. Production allows `/` and disallows `/app/`, `/portal/`, `/api/`.

> ⚠️ This file carries `export const dynamic = "force-dynamic"` and **must keep it.** `robots.ts` is a Route Handler that Next prerenders by default; without it, the build-time `APP_ENV` gets baked into the output — which would ship a `Disallow: /` robots.txt to production and quietly deindex the marketing site.

**3. HTTP basic auth — `dokku http-auth`.** The layer that actually enforces anything. Layers 1 and 2 are requests, not barriers; a crawler that ignores `robots.txt` also ignores `X-Robots-Tag`. Recommended for staging, and covered in checklist section L.

### The `APP_ENV` footgun

`proxy.ts` and `app/robots.ts` both **fail closed**: anything that is not exactly `production` is treated as staging and marked noindex.

That is the safe direction — a missing variable hides staging rather than exposing it — but it does mean **forgetting `APP_ENV=production` on the production app makes the marketing site invisible to search.** Hence the post-deploy check in `deploy-production`, which fails the job if `/` ever comes back carrying a `noindex`. Silent deindexing is the kind of failure nobody notices for six weeks.

---

## Current status

**The pipeline is scaffolded and verified locally.** As of this commit it builds and serves the stock scaffold:

- `docker build` succeeds; image is ~400 MB
- container runs as non-root (uid 1001 `nextjs`), binds `0.0.0.0:3000`
- `GET /api/health` → `{"status":"ok","sha":"<git sha>"}`
- `GET /` → 200
- `/robots.txt` builds as a dynamic route (`ƒ`), not prerendered

Verified by running **one image** twice with different `APP_ENV`:

| Check | `APP_ENV=staging` | `APP_ENV=production` |
|---|---|---|
| `X-Robots-Tag` on `/` | `noindex, nofollow, …` | *(absent — indexable)* |
| `X-Robots-Tag` on `/app` | `noindex, nofollow, …` | `noindex, nofollow, …` |
| `X-Robots-Tag` on `/portal` | `noindex, nofollow, …` | `noindex, nofollow, …` |
| `robots.txt` | `Disallow: /` + 23 AI agents | `Allow: /`, disallows `/app/ /portal/ /api/` |

### Verify locally before touching the VPS

```sh
docker build --build-arg GIT_SHA=localtest -t portico:localtest .

# staging behaviour
docker run -d --name portico-stg -e APP_ENV=staging -p 3401:3000 portico:localtest
curl -sI http://localhost:3401/ | grep -i x-robots-tag   # expect noindex
curl -s  http://localhost:3401/robots.txt                # expect Disallow: /

# production behaviour, same image
docker run -d --name portico-prod -e APP_ENV=production -p 3402:3000 portico:localtest
curl -sI http://localhost:3402/ | grep -i x-robots-tag   # expect NOTHING
curl -sI http://localhost:3402/app | grep -i x-robots-tag # expect noindex

docker rm -f portico-stg portico-prod
```

---

## Design decisions worth not re-litigating

**Debian slim, not Alpine.** When Prisma lands, musl/OpenSSL query-engine mismatches on Alpine are a known and tedious failure mode. The size saving isn't worth the afternoon.

**`output: "standalone"`.** Emits a self-contained `server.js` with only traced runtime dependencies. The consequence to remember: **tracing only includes what the app imports.** Anything invoked as a CLI (the Prisma binary, `tsx`) is invisible to it and must be copied explicitly.

**`images: { unoptimized: true }`.** Runtime image optimization is the wrong trade on a 4 GB box with 2 *shared* vCPUs: resizing is CPU-bound and competes with both app containers, and sharp on glibc needs `MALLOC_ARENA_MAX` tuning to avoid runaway memory (flagged in Next's own self-hosting docs). `scripts/prep-images.ts` pre-generates AVIF/WebP variants at known dimensions instead, which meets the Lighthouse ≥95 budget without the runtime cost.

**Healthcheck at `/api/health`, `dynamic = "force-dynamic"`.** If it were statically prerendered the check would pass against a stale build rather than a live server.

**In-memory rate limiting.** Single instance per app, so a sliding window keyed on `x-forwarded-for` is genuinely correct — no Redis, none of the serverless multi-instance caveats.

**Dokku healthchecks bypass nginx.** They hit the container directly, so basic auth on staging does not break the deploy's own readiness check. Only external checks need credentials.

---

## Phase 1 additions

`app.json` is strict JSON and cannot carry comments, so the pending changes are recorded here. **Both apps** pick these up from the image automatically — there is nothing per-environment to configure.

### 1. `app.json` — migration hook and nightly reset

```json
{
  "scripts": {
    "dokku": {
      "predeploy": "pnpm prisma migrate deploy"
    }
  },
  "cron": [
    {
      "command": "pnpm tsx scripts/reset-demo.ts",
      "schedule": "0 8 * * *"
    }
  ],
  "healthchecks": { "...": "keep the existing block" }
}
```

Migrations belong in `predeploy` — it runs before traffic shifts, and its changes are committed to the image. Never migrate at container start.

The nightly reset uses **Dokku's native cron** rather than a scheduled GitHub Action: no public endpoint to protect, no shared secret, and GH Actions cron can drift 10–30 minutes.

> Note: the cron ships in the image, so **staging resets nightly too.** That is desirable — it exercises the reset path before production does. Confirm both with `dokku cron:list portico` and `dokku cron:list portico-staging`.

### 2. `Dockerfile` — the easiest thing to get wrong

Standalone tracing does **not** include `prisma/schema.prisma` or the Prisma CLI, so the `predeploy` hook above fails without these in the runner stage:

```dockerfile
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
```

Also add `RUN pnpm prisma generate` to the builder stage, generating the client to `lib/generated/prisma` so tracing picks it up.

### 3. `package.json` — runtime dependencies

`tsx` must be a **production** dependency, not a dev one: the app.json cron invokes `scripts/reset-demo.ts` inside the running container. Same for `scripts/seed.ts`.

### 4. `pnpm-workspace.yaml` — unblock sharp

`sharp` currently sits in `ignoredBuiltDependencies`, so its native binary never builds. Move it to `onlyBuiltDependencies` before writing `scripts/prep-images.ts`.

### 5. `proxy.ts` — add the optimistic auth check

The file currently only sets robots headers. Phase 1 adds a cookie-*presence* check that bounces anonymous traffic off `/app` and `/portal`. Keep it optimistic — no database calls, no decryption. Real authorization stays in the DAL and in each server action.

---

## Operational notes

**First seed**, once per environment:
```sh
dokku run portico         pnpm tsx scripts/seed.ts
dokku run portico-staging pnpm tsx scripts/seed.ts
```

**Rollback** to any previously built commit — every push leaves a tagged image in GHCR:
```sh
ssh dokku@HOST git:from-image portico ghcr.io/<owner>/portico:<older-sha>
```

**Promote the exact artifact staging validated** — no rebuild, so nothing can drift between the two:
```sh
ssh dokku@HOST git:from-image portico ghcr.io/<owner>/portico:<sha-currently-on-staging>
```

**Logs:** `dokku logs portico -t` · `dokku logs portico-staging -t`

**Disk:** `docker system prune -af` monthly. Two apps plus two Postgres services accumulate old image layers noticeably faster than one.

**No database backups.** The data is seeded and truncated nightly by design — backing it up would be theatre. Deliberate, not an oversight.
