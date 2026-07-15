# GCC Bond Trading Platform

A full-stack demo of a Gulf-region fixed-income trading venue: browse GCC
sovereign & corporate USD eurobonds and sukuk, complete KYC, fund a wallet,
place limit/market orders against a real price-time-priority matching engine,
and settle trades — with an admin/compliance back office for KYC review, AML
alerts, settlement monitoring, and an immutable audit trail.

> **Status:** demo / portfolio project. Payments, KYC provider, and settlement
> run in demo mode (no real money movement). See [Demo mode](#demo-mode).

---

## Architecture

Three tiers behind an API gateway:

```
                    ┌──────────────────────────────┐
   Browser  ───────▶│  Angular 18 SPA (Vercel)     │
                    └──────────────┬───────────────┘
                                   │ HTTPS  /api/v1/*
                    ┌──────────────▼───────────────┐
                    │  Node.js / Express Gateway    │  ← auth, KYC, wallet,
                    │  (Render / Docker)            │    orders, matching,
                    └──┬────────┬────────┬──────────┘    portfolio, AML, audit
                       │        │        │
        ┌──────────────┘        │        └───────────────┐
        ▼                       ▼                         ▼
  PostgreSQL              Redis (cache,            MongoDB (encrypted KYC
  (Supabase)             sessions, locks)          docs, immutable audit log)
        │
        ▼
  RabbitMQ (domain events)  ──▶  optional .NET microservices
                                 (trading, marketplace, settlement,
                                  portfolio, AML)
```

- **Frontend** — Angular 18 standalone components, signals, lazy-loaded routes,
  glassmorphism UI. Deployed on Vercel.
- **API gateway** — Node.js + Express + TypeScript. Owns auth, KYC, wallet,
  order placement, the matching engine, portfolio, AML, and audit. Deployed on
  Render (Docker). This is the primary backend and runs standalone.
- **.NET microservices** — five ASP.NET Core services (trading, marketplace,
  settlement, portfolio, AML). Optional; the Node gateway serves these domains
  natively when the services aren't deployed.
- **Data stores** — PostgreSQL (Supabase) for relational data, Redis for
  sessions/caching/distributed locks, MongoDB for encrypted KYC documents and
  the append-only audit log, RabbitMQ for the domain-event bus.

### Key domains

| Domain | Highlights |
|--------|-----------|
| Auth | JWT access+refresh pair, Redis token revocation, bcrypt, optional TOTP 2FA, OAuth (Google/Microsoft) |
| KYC | Risk tiers (LOW 10K / MEDIUM 50K / HIGH 200K AED limits), document upload, manual review workflow |
| Wallet | Optimistic locking (`version` column), demo deposits, maker-checker on large withdrawals |
| Trading | Price-time-priority matching, `FOR UPDATE SKIP LOCKED`, distributed Redis lock, limit + market orders |
| Settlement | T+0 instant settlement (demo), fee schedule (25bps buyer + 25bps seller + 10bps settlement) |
| AML | Rule-based alerts, severity tiers, escalation & SAR workflow |
| Audit | Immutable Mongo-backed log, 7-year TTL |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 18, TypeScript, RxJS, Angular signals |
| API | Node.js 20, Express 4, TypeScript, Zod validation |
| Auth | JWT (`jsonwebtoken`), bcrypt, `speakeasy` (TOTP) |
| Data | PostgreSQL 16, Redis 7 (`ioredis`), MongoDB 7 (`mongoose`) |
| Messaging | RabbitMQ (`amqplib`) |
| Microservices | ASP.NET Core (.NET 9) |
| Deploy | Vercel (SPA), Render / Docker Compose (backend), Supabase (DB) |

---

## Local setup

### Prerequisites
- Node.js 20+
- Docker + Docker Compose (for the full stack) **or** access to hosted
  Postgres/Redis/Mongo/RabbitMQ (e.g. Supabase, Upstash, Atlas, CloudAMQP)

### Option A — full stack with Docker Compose

Brings up nginx, the Node gateway, all 5 .NET services, Postgres, Redis,
MongoDB, and RabbitMQ:

```bash
cd backend
cp .env.example .env        # fill in secrets (see Environment variables)
docker compose up --build
```

The Postgres container auto-runs `migrations/001_*.sql` and `002_seed_data.sql`
on first boot. API gateway: http://localhost:3000 · RabbitMQ UI:
http://localhost:15672.

### Option B — frontend + gateway only (against hosted data services)

```bash
# 1. API gateway
cd backend/node-api
cp .env.example .env        # point DATABASE_URL/REDIS_URL/... at hosted services
npm install
npm run dev                 # ts-node-dev on :3000

# 2. Apply schema + seed once against your database
psql "$DATABASE_URL" -f ../migrations/001_supabase_schema.sql
psql "$DATABASE_URL" -f ../migrations/002_seed_data.sql

# 3. Create an admin + demo users
npm run create-admin
npm run seed-test-users

# 4. Frontend (repo root, separate terminal)
cd ../..
npm install
npm start                   # ng serve on :4200 → proxies /api to :3000
```

Open http://localhost:4200.

### Seeded demo accounts

`npm run seed-test-users` creates:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | Admin1234! |
| Seller (investor) | seller@test.com | Test1234! |
| Buyer (investor) | buyer@test.com | Test1234! |

---

## Environment variables

Full reference in [`backend/node-api/env.production.example`](backend/node-api/env.production.example).
Required for the gateway to start:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Postgres connection string (Supabase: use the **session pooler**, port 5432, `?sslmode=require`) |
| `REDIS_URL` | ✅ | `rediss://…` (Upstash) or `redis://…` |
| `ENCRYPTION_KEY` | ✅ | Exactly 64 hex chars (32 bytes). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | ✅ | ≥32 chars each |
| `SERVICE_SECRET` | ✅ | ≥16 chars (service-to-service auth) |
| `MONGODB_URI` | optional | Audit log + KYC document storage; degrades gracefully if unset |
| `RABBITMQ_URL` | optional | Domain-event publishing; degrades gracefully if unset |
| `ALLOWED_ORIGINS` | optional | Comma-separated CORS allowlist; the production frontend and `*.vercel.app` previews are always allowed |
| `SENDGRID_*`, `ONFIDO_*`, `HYPERPAY_*`, `GOOGLE_*`, `MICROSOFT_*` | optional | Third-party integrations; features degrade gracefully when unset |

---

## Deployment

| Target | Config | Deploys |
|--------|--------|---------|
| **Vercel** | `vercel.json` | Angular SPA from `main` |
| **Render** | `render.yaml` | Node gateway + 5 .NET services (Docker) |
| **Docker** | `backend/docker-compose.yml` | Full self-hosted stack |
| **Railway** | `railway/*.toml` | Alternative container host |
| **Supabase** | `backend/migrations/*.sql` | Managed Postgres + schema |

On Render, set every `sync: false` variable in the dashboard, then push — it
builds and deploys automatically. See `render.yaml` for the full list.

> **Supabase free tier note:** projects auto-pause after 7 days of no database
> activity, which takes the API down. Restore from the Supabase dashboard, or
> keep it warm with a periodic `/health` ping.

---

## Demo mode

To keep the project runnable without live vendor accounts:

- **Payments** — `POST /wallet/deposit/demo-complete` simulates a settled
  deposit (disabled in production unless HyperPay is configured).
- **KYC** — completed checks route to manual review rather than auto-approving.
- **Settlement** — T+0 instant settlement instead of a real T+2 cycle.
- **Market data** — bond prices/ticks are simulated client-side; the order book
  and matching engine, however, operate on real resting orders.

---

## Project layout

```
.
├── src/                          # Angular 18 SPA
│   └── app/
│       ├── core/                 # auth, guards, interceptors, models, services
│       ├── pages/                # feature screens (trading, portfolio, admin, …)
│       └── services/             # API clients
├── backend/
│   ├── node-api/                 # Node.js/Express gateway (primary backend)
│   │   └── src/
│   │       ├── modules/          # auth, kyc, wallet, orders, portfolio, aml, …
│   │       ├── core/             # db clients, crypto, events, logger, errors
│   │       ├── middlewares/      # auth, rate-limit, validation, error handler
│   │       └── jobs/             # scheduled background jobs
│   ├── dotnet-services/          # 5 ASP.NET Core microservices
│   ├── migrations/               # SQL schema + seed data
│   └── docker-compose.yml        # full-stack local orchestration
├── render.yaml                   # Render blueprint
└── vercel.json                   # Vercel SPA config
```

---

## API surface

The gateway exposes ~48 endpoints under `/api/v1` across these modules:
`auth`, `kyc`, `wallet`, `bonds`, `orders`, `portfolio`, `settlements`,
`aml`, `notifications`, `admin`, `audit`. Health check at `GET /health`
(returns `200` with a per-service status object).
