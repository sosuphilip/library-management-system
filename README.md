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
