# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Backend — Express + Prisma API
# Targets:
#   dev  — tsx watch with mounted source (used by `docker compose up --build`)
#   prod — compiled tsc output, runs migrations + seed on start
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Skip @prisma/client's postinstall generate; we generate explicitly after the
# schema is available.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
ENV NPM_CONFIG_FUND=false

# ---- Development -----------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY . .
EXPOSE 4000
# compose overrides the command with `prisma migrate deploy && db seed && npm run dev`

# ---- Build (compile TS) -----------------------------------------------------
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Production -------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]
