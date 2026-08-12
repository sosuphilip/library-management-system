# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Root-level build for the backend API.
#
# This lets Railway (or any Docker host) deploy the backend from the REPO ROOT
# with NO "Root Directory" setting — a common source of failed monorepo builds.
# docker-compose local dev uses backend/Dockerfile (unchanged).
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Skip @prisma/client's postinstall generate; we generate explicitly after the
# schema is available.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
ENV NPM_CONFIG_FUND=false

# ---- Build (compile TS) -----------------------------------------------------
FROM base AS build
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Production -------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
# Seed only when explicitly requested — the seed truncates all tables, so it
# must never run implicitly on every restart/deploy.
#   docker run -e SEED_ON_START=true ...   (one-time demo data)
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then npx prisma db seed; fi && node dist/index.js"]
