# syntax=docker/dockerfile:1
#
# Portico runtime image.
#
# Debian slim, NOT Alpine, and Prisma is still the reason.
#
# Prisma 7 replaced the Rust QUERY engine with an in-process query compiler, so
# the app itself carries no native binary. Migrations are a different story:
# @prisma/engines still ships a ~28MB native `schema-engine-linux-<arch>-openssl-<ver>`
# that `migrate deploy` shells out to. It is glibc-linked and its filename
# encodes the OpenSSL version it expects, which is precisely the musl/OpenSSL
# matching problem Alpine causes.
#
# Built in GitHub Actions and pushed to GHCR; the VPS only ever pulls. See
# docs/DEPLOY.md and docs/SETUP-CHECKLIST.md.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
# pnpm-workspace.yaml carries onlyBuiltDependencies/ignoredBuiltDependencies,
# so it must be present or native build scripts resolve differently than local.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `pnpm build` runs `prisma generate` first -- see package.json. It is in the
# script rather than a separate RUN here so that a local build and a Docker
# build cannot diverge: the client is gitignored, so EVERY fresh checkout needs
# generating, and a step that exists only in the Dockerfile is one that breaks
# for the next person running `pnpm build` on a clean clone.
#
# The generator writes to lib/generated/prisma -- inside the repo, so Next's
# standalone output tracing can see it being imported. A client generated into
# node_modules is invisible to tracing and vanishes from the runtime image.

ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
RUN pnpm build

# ---- prisma CLI -------------------------------------------------------------
# `prisma migrate deploy` runs as app.json's predeploy hook, so the CLI has to
# exist in the runtime image. It cannot simply be copied out of the builder:
# pnpm's node_modules is a symlink farm into .pnpm, and `COPY --from` copies the
# symlink rather than what it points at, producing a dangling link that fails
# with a bare ENOENT.
#
# npm is used here precisely because it produces a real, hoisted tree that can
# be copied wholesale. The version is pinned to match @prisma/client: a CLI and
# client that disagree will happily write migrations the client cannot read.
#
# NOTE ON THE REGISTRY: `prisma`'s `latest` dist-tag currently points at
# 8.0.0-rc.12, a release candidate, while @prisma/client's `latest` is the
# stable 7.10.0. An unpinned install therefore pairs an RC CLI with a stable
# client. Pin both; do not "helpfully" bump this to latest.
FROM base AS prisma-cli
WORKDIR /cli
RUN npm install --no-save --no-audit --no-fund prisma@7.10.0

# ---- runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Prisma's platform detection warns loudly on every invocation without it:
#
#   Please manually install OpenSSL via `apt-get update -y && apt-get install -y
#   openssl` and try installing Prisma again.
#
# `migrate deploy` does in fact succeed regardless -- Prisma 7 has no native
# engines to link against. It is installed anyway because the warning prints
# above the migration output on EVERY deploy, and a log line that everyone
# learns to scroll past is how the genuinely important line gets missed. This
# repo has already been bitten once by exactly that, when a grey "No
# healthchecks found in app.json" hid a missing file.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Dokku reads app.json OUT OF THE IMAGE, at WORKDIR/app.json -- it is not read
# from the repo, because with `git:from-image` the repo is never on the server.
# Standalone output tracing does not include it (nothing imports it), so
# without this line the file simply is not there and Dokku silently proceeds
# without it. The deploy log admits this in one grey line:
#
#   No healthchecks found in app.json for web process type
#
# Today that only downgrades the /api/health startup check to a generic port
# check. In Phase 1 it is much worse: `scripts.dokku.predeploy` is where
# `prisma migrate deploy` runs, so a missing app.json means migrations never
# run in production and the app starts against an unmigrated database. The
# `cron` block for the nightly reset would go missing the same way.
COPY --from=builder /app/app.json ./app.json

# Everything `prisma migrate deploy` needs at runtime. Standalone tracing
# includes none of it, because nothing in the app imports any of it.
#
# The CLI goes in its own tree rather than into ./node_modules on purpose. The
# app's node_modules is Next's traced output; merging a second dependency tree
# into it risks a shared transitive package resolving to the CLI's copy instead
# of the one the app was built against -- a class of bug that shows up at
# runtime, in production, and nowhere else.
# --chown matters. Prisma's platform detection writes into @prisma/engines on
# startup, and the app runs as uid 1001, so a root-owned tree fails with:
#   Can't write to /app/prisma-cli/node_modules/@prisma/engines
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Required, not optional: `migrate deploy` refuses to run without a config file
# even when DATABASE_URL is set and --schema is passed. See prisma7.config.ts.
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts

# The seed, as a single pre-bundled file:
#
#   dokku run <app> node dist-scripts/seed.mjs
#
# It is bundled at build time (see `build:scripts`) rather than shipped as
# TypeScript source plus a `tsx` runtime, because the standalone output contains
# NO @prisma packages at all -- Next compiles the client into its own server
# bundle, so there is nothing for a separate script to import. Shipping source
# would mean a second dependency tree just to run one file, on top of the one
# already carried for the Prisma CLI.
#
# esbuild specifics that are not optional:
#   - format=esm, not cjs. CJS output dies on `import.meta.url` being undefined.
#   - the createRequire banner. `pg` is CommonJS and dynamically requires node
#     builtins, which an ESM bundle rejects with "Dynamic require of \"events\"
#     is not supported".
#   - pg-native external: an optional native dependency that is not installed.
COPY --from=builder --chown=nextjs:nodejs /app/dist-scripts ./dist-scripts

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
