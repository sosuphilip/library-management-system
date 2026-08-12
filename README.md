# 📚 Library Management System

A full-stack library management app: **React + TypeScript** frontend, **Express + TypeScript** API, **PostgreSQL + Prisma** persistence, and **JWT** authentication with refresh rotation.

Built in phases — backend (auth, catalog, circulation, members, reports, notifications) and a complete web client, wired together with Docker for local dev.

## Features

- **Auth** — member self-registration, staff/admin login, JWT access + rotating refresh tokens, password reset, per-role authorization.
- **Catalog** — books, authors, categories, multiple copies per book, search (title/author/ISBN/publisher), category & availability filters, ISBN auto-lookup.
- **Circulation** — checkout, return (with automatic daily fines at return-time), renewal (with per-book max), holds/queue, copy status tracking.
- **Members** — directory with search, member dossier (loans, holds, fines), suspension/reinstatement policy, staff fine waive/adjust.
- **Reports** — dashboard stats, most-borrowed, overdue list, CSV exports.
- **Notifications** — daily cron for due-soon / overdue / hold-expiry emails (JSON transport in dev).

## Tech stack

| Layer      | Tech                                                          |
| ---------- | ------------------------------------------------------------- |
| Frontend   | React 18, Vite 6, TypeScript, Tailwind CSS, React Router, TanStack Query |
| Backend    | Express 4, TypeScript, Prisma 6, Zod, JWT, bcrypt, node-cron, Nodemailer |
| Database   | PostgreSQL 17                                                   |
| Testing    | Jest + Supertest (backend), Vitest (frontend), Playwright (scaffolded) |
| Infra      | Docker Compose, multi-stage Dockerfiles, GitHub Actions CI      |

## Project structure

```
library-app/
├── backend/            Express API
│   ├── prisma/         schema + migrations + seed
│   ├── src/
│   │   ├── config/     env + library policy
│   │   ├── controllers/  HTTP handlers
│   │   ├── middleware/   auth, validation, rate limiting
│   │   ├── routes/v1/    API route definitions
│   │   ├── schemas/      zod request validation
│   │   ├── services/     business logic
│   │   └── jobs/         daily notification cron
│   └── tests/          jest + supertest suites
├── frontend/           React SPA
│   ├── src/
│   │   ├── components/   layout, guards, UI kit
│   │   ├── context/      auth session
│   │   ├── lib/          api client, types, format helpers
│   │   └── pages/        login, catalog, circulation, members, reports…
│   └── nginx.conf      SPA static serving (prod image)
└── docker-compose.yml  db + backend + frontend
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with the WSL2 backend enabled (Windows: ensure **Virtual Machine Platform** is on, then reboot).
- Node 22 + npm 11 (only for non-Docker local dev).

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API:      http://localhost:4000/api/v1

The backend container runs `prisma migrate deploy`, seeds demo data, then starts a hot-reload dev server. Source is volume-mounted, so edits to `backend/src` or `frontend/src` reload automatically.

To run just the database:

```bash
docker compose up -d db
```

### Demo logins (password: `Passw0rd!`)

| Role      | Email                       |
| --------- | --------------------------- |
| Admin     | admin@library.local         |
| Librarian | librarian@library.local     |
| Member    | ada.lovelace@example.com    |

## Local development (without Docker)

You still need a Postgres database. Either use the compose db (`docker compose up -d db`) or your own instance.

### Backend

```bash
cd backend
cp .env.example .env          # fill in secrets
npm ci
npx prisma migrate dev        # create schema + migration
npm run db:seed               # demo data (51 books, 10 members, demo loans)
npm run dev                   # http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000/api/v1
npm ci
npm run dev                   # http://localhost:5173
```

CORS is configured for `http://localhost:5173` in `backend/.env`.

## Testing

### Backend (Jest + Supertest)

Tests run against a **dedicated** database so they never touch your seeded dev data:

```bash
cd backend
# create the test database (one-time)
docker exec library-db createdb -U library library_test
DATABASE_URL="postgresql://library:library@localhost:5432/library_test" npx prisma migrate deploy

# run the suite (88 tests across auth, catalog, circulation, members, reports, notifications)
DATABASE_URL="postgresql://library:library@localhost:5432/library_test" npm test
```

> ⚠️ Running `npm test` without the `DATABASE_URL` override truncates the **dev** `library` database. Always point tests at `library_test`.

### Frontend (Vitest)

```bash
cd frontend
npm test
```

## Docker images

Both Dockerfiles are multi-stage:

| Service  | Target | Purpose                                    |
| -------- | ------ | ------------------------------------------ |
| backend  | `dev`  | `tsx watch`, source mounted, used by compose |
| backend  | `prod` | compiled JS, runs `migrate deploy` + seed on start |
| frontend | `dev`  | Vite dev server, used by compose             |
| frontend | `prod` | static build served by nginx (SPA routing)   |

```bash
docker build --target prod -t library-backend:prod ./backend
docker build --target prod -t library-frontend:prod ./frontend
```

For the frontend prod image, `VITE_API_URL` is baked in at build time:

```bash
docker build --build-arg VITE_API_URL=https://api.example.com/api/v1 --target prod -t library-frontend:prod ./frontend
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

- **Backend** — against a disposable Postgres 17 service: `prisma migrate deploy`, lint, type-check, 88 jest tests.
- **Frontend** — lint, build, vitest.

## Key environment variables

Backend (`backend/.env`) — see `.env.example` for all:

| Variable                        | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL connection string              |
| `APP_BASE_URL`                  | Origin used in emailed links (password reset) — must be the **frontend**, e.g. `http://localhost:5173` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | signing secrets                  |
| `CORS_ORIGINS`                  | comma-separated allowed browser origins   |
| `MAIL_TRANSPORT`                | `json` logs emails (dev) or `smtp`        |
| `DEFAULT_LOAN_PERIOD_DAYS` etc. | library policy knobs (fines, renewals, suspension) |

Frontend (`frontend/.env`): `VITE_API_URL` — base URL of the API (`/api/v1` included).

## Deploying to production

The app splits cleanly for free-tier hosting:

| Part     | Host                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Frontend | **GitHub Pages** (`https://<user>.github.io/library-management-system/`) |
| Backend  | **Railway** (long-running Node service — the daily cron needs it)      |
| Database | **Railway Postgres** (or Neon — free serverless Postgres)              |

> ⚠️ GitHub Pages can only serve static files — it **cannot** run the Express
> API or Postgres. The backend needs a real host like Railway, Render, Fly.io
> or Koyeb.

### 1. Backend + database on Railway

1. Push this repo to GitHub, then sign up at [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub repo** → pick this repo.
3. When it asks about the service, set the **Root Directory** to `backend`
   (this repo is a monorepo). Railway reads `backend/railway.json`, builds the
   production Docker image, and runs `prisma migrate deploy` at startup.
4. Add a **Postgres** plugin (Project → New → Database → PostgreSQL). Copy its
   `DATABASE_URL` into the backend service's variables.
5. Add the remaining environment variables to the backend service:

   | Variable             | Value                                                        |
   | -------------------- | ------------------------------------------------------------ |
   | `DATABASE_URL`       | from the Postgres plugin                                     |
   | `JWT_ACCESS_SECRET`  | long random string (`openssl rand -hex 32`)                  |
   | `JWT_REFRESH_SECRET` | different long random string                                 |
   | `CORS_ORIGINS`       | `https://<user>.github.io`                                   |
   | `APP_BASE_URL`       | `https://<user>.github.io/library-management-system`         |
   | `MAIL_TRANSPORT`     | `json` (emails are logged, not delivered, on the free tier)  |
   | `NODE_ENV`           | `production`                                                 |

6. **Seed once** (the seed truncates all tables, so it must NEVER run
   automatically on every deploy). Run it from your machine against the
   Railway database — the prod image has no `tsx`, so a Railway shell won't
   work:

   ```bash
   cd backend
   DATABASE_URL="<railway-db-connection-string>" npm run db:seed
   ```
7. The API is live at `https://<your-app>.up.railway.app` — verify
   `GET /health` returns `{"status":"ok"}`.

### 2. Frontend on GitHub Pages

1. Repo **Settings → Pages → Source → GitHub Actions** (the workflow
   `.github/workflows/deploy-frontend.yml` does the rest).
2. Add a repository secret `VITE_API_URL` = `https://<your-app>.up.railway.app/api/v1`
   (Settings → Secrets and variables → Actions). The deploy workflow fails
   loudly until this is set, so you can't ship a broken bundle.
3. Push to `master` (or run **Actions → Deploy frontend to GitHub Pages →
   Run workflow**) and the SPA appears at
   `https://<user>.github.io/library-management-system/`.
4. Sign in with the seeded demo accounts (password `Passw0rd!`).

> The build bakes `VITE_BASE=/<repo-name>/` (auto-derived from the repo name)
> so assets resolve under the Pages sub-path, and copies `index.html` to
> `404.html` so deep links work (GitHub Pages' SPA fallback). If you ever
> rename the repo, the Pages URL changes with it.
>
> Other hosts using the Docker image directly (Render, etc.): the image only
> seeds when you set `SEED_ON_START=true`, so restarts are data-safe by
> default.

## API overview

All routes are prefixed `/api/v1` and return JSON `{ ... }` (errors: `{ error: { code, message } }`).

| Area        | Endpoints (select)                                                          |
| ----------- | -------------------------------------------------------------------------- |
| Auth        | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Catalog     | `GET/POST /catalog`, `GET/PATCH/DELETE /catalog/:id`, `POST /catalog/:id/copies`, `PATCH/DELETE /catalog/copies/:id`, `GET /catalog/isbn/:isbn`, `GET /catalog/authors`, `GET /catalog/categories` |
| Circulation | `POST /circulation/checkout`, `POST /circulation/returns`, `POST /circulation/loans/:id/renew`, `POST /circulation/reserve`, `GET /circulation/loans`, `GET /circulation/me/loans`, `/me/reservations`, `/me/fines`, `POST /circulation/fines/pay` |
| Members     | `GET /members`, `GET /members/:id`, `POST /members/:id/suspend`, `/reinstate`, `POST /members/fines/:id/adjust` |
| Reports     | `GET /reports/dashboard`, `/reports/most-borrowed`, `/reports/overdue`, `/reports/export/:kind` |
| Notifications | `GET /notifications/me`                                                 |
