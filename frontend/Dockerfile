# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Frontend — React + Vite SPA
# Targets:
#   dev  — Vite dev server (used by `docker compose up --build`)
#   prod — static build served by nginx (SPA routing)
# ---------------------------------------------------------------------------

# ---- Development ------------------------------------------------------------
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---- Build (static assets) ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# API base URL is baked into the bundle at build time.
ARG VITE_API_URL=http://localhost:4000/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production (nginx) -------------------------------------------------------
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
