# syntax=docker/dockerfile:1
#
# Portico runtime image.
#
# Debian slim, NOT Alpine -- when Prisma lands in Phase 1, musl/OpenSSL query
# engine mismatches on Alpine are a known and tedious failure mode. The size
# difference is not worth it.
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

# PHASE 1: add `RUN pnpm prisma generate` here, once prisma/schema.prisma
# exists. Generate the client to lib/generated/prisma so Next's standalone
# output tracing picks it up.

ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
RUN pnpm build

# ---- runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

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

# PHASE 1 -- standalone output tracing does NOT include prisma/schema.prisma or
# the Prisma CLI, so `prisma migrate deploy` in app.json's predeploy hook will
# fail without these three lines. This is the single easiest thing to get wrong:
#
#   COPY --from=builder /app/prisma ./prisma
#   COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
#   COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
#
# `tsx` is likewise needed at runtime for scripts/seed.ts and
# scripts/reset-demo.ts (invoked by the app.json cron), so it belongs in
# `dependencies`, not `devDependencies`.

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
