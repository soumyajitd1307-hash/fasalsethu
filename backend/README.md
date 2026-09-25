# FasalSethu Backend (foundation)

Express + PostgreSQL (Prisma) backend. Frontend is untouched — this service is independent.

## Structure

```text
backend/
  prisma/schema.prisma      # Farmer, Buyer, CropListing, BuyerRequirement + relations
  src/
    config/env.js           # PORT / DATABASE_URL / CORS_ORIGIN
    config/database.js      # Prisma singleton + checkConnection()
    controllers/healthController.js
    routes/health.routes.js # GET /api/health
    services/dbService.js
    models/index.js         # Prisma is source of truth (see schema)
    middleware/notFound.js, errorHandler.js
    utils/validate.js       # zod schemas for 4 entities
    app.js                  # express app (cors, json, /api/health, 404, errors)
    server.js               # listen + graceful shutdown
```

## Prerequisites

- Node.js >= 18
- PostgreSQL 14+ (local or hosted). No live DB is required to boot — `/api/health` reports `database.configured=false` when `DATABASE_URL` is unset.

## Install

```bash
cd backend
npm install
```

## Configure

```bash
cp .env.example .env
# edit .env: set PORT and DATABASE_URL
```

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Backend port |
| `DATABASE_URL` | — | Prisma Postgres URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated |
| `NODE_ENV` | `development` | `development` shows error stacks |

## Database setup (PostgreSQL + Prisma)

```bash
# validate schema (no DB needed)
npm run db:validate
# generate client
npm run db:generate
# create dev migration + apply to DB (needs live DATABASE_URL)
npm run db:migrate
# production apply
npm run db:deploy
# optional GUI
npm run db:studio
```

Tables: `farmers`, `buyers`, `crop_listings`, `buyer_requirements`.
Relations: `Farmer 1—N CropListing`, `Buyer 1—N BuyerRequirement` (FK cascade delete).

## Start

```bash
npm run dev   # nodemon, development
npm start     # production
```

Backend port: `http://localhost:8000` (or `$PORT`).

## Health check

```bash
curl http://localhost:8000/api/health
```

Expected (DB unconfigured):

```json
{
  "status": "ok",
  "message": "FasalSethu backend is running",
  "timestamp": "...",
  "uptimeSeconds": 1,
  "database": { "configured": false, "connected": false, "reason": "DATABASE_URL not set" }
}
```

With a live DB: `"database": { "configured": true, "connected": true, "latencyMs": N }`.

## Farmer API (B1 Task 2)

Requires live `DATABASE_URL` (endpoints return `503` when unconfigured).

| Method | Endpoint | Success |
|---|---|---|
| `POST` | `/api/farmers` | `201 { success: true, data }` |
| `GET` | `/api/farmers?page=1&limit=20` | `200 { success: true, data, pagination }` |
| `GET` | `/api/farmers/:id` | `200 { success: true, data }` |
| `PATCH` | `/api/farmers/:id` | `200 { success: true, data }` |
| `DELETE` | `/api/farmers/:id` | `200 { success: true, data }` |

- Pagination: defaults `page=1, limit=20`, max `limit=100`; invalid values → `400`.
- Create accepts only `name, phone, email?, village?, district?, state?, latitude?, longitude?` (`kycStatus` defaults to `PENDING`). Update additionally accepts `kycStatus`. `id/createdAt/updatedAt/trustScore` are rejected.
- Errors: `400` validation, `404` not found, `409` duplicate email, via central error handler.

## Notes for next modules

- Matching, maps, auth are NOT implemented here — only schema + validation placeholders.
- Use `validateBody(schema)` from `src/utils/validate.js` in future POST/PUT routes.
