# FasalSethu Backend (foundation)

Express + PostgreSQL (Prisma) backend. Frontend is untouched — this service is independent.

Product terminology: **Buyer = Retailer**. The database/API models keep the names `Buyer` / `BuyerRequirement` (a `BuyerRequirement` is a retailer's crop purchasing requirement). No retailer matching is implemented yet — do not rename these models casually.

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
| `DATABASE_URL` | — | Prisma Postgres URL, e.g. `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` (never commit real credentials) |
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

Tables: `farmers`, `buyers`, `crop_listings`, `buyer_requirements`, `market_prices`.
Relations: `Farmer 1—N CropListing`, `Buyer 1—N BuyerRequirement` (FK cascade delete).
Applied migration: `backend/prisma/migrations/20260925130308_init_marketplace_schema` (all five tables + indexes; verified against live PostgreSQL in Task 5).

## Start

```bash
npm run dev   # nodemon, development
npm start     # production
```

Backend port: `http://localhost:8000` (or `$PORT`). The server binds the configured port on all interfaces, so platforms can route to it; `npm start` runs plain `node` (no nodemon) for production.

## Production deployment prerequisites (not yet deployed)

1. Provision managed PostgreSQL; set `DATABASE_URL` (format `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`, `?schema=public` for Prisma).
2. Set `NODE_ENV=production`, `PORT` (or accept the platform default), and `CORS_ORIGIN` to the deployed frontend origin(s).
3. Install + generate + apply migrations once: `npm install`, `npm run db:generate`, `npm run db:deploy` (never `migrate reset` / drops; no seed step exists).
4. Start with `npm start`; verify `GET /api/health` shows `database.connected: true`.
5. No cloud provider, database, or public URL exists yet — nothing here claims otherwise.

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

## Tests (Task 6)

No external test framework — the suite uses Node's built-in `node:test` + `node:assert` (zero new dependencies, no internet needed; all HTTP tests hit `127.0.0.1` only).

```bash
npm test                # unit + integration (integration needs DATABASE_URL)
npm run test:unit        # validation / normalization / CSV only, always runnable
npm run test:integration # live API tests, requires DATABASE_URL
```

- `npm test` exits `0` on success, non-zero on any failure, with readable `✔/✖` output.
- Without `DATABASE_URL`, DB tests report `BLOCKED` (skipped with reason) instead of faking results; e.g. `DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE" npm test` runs the full suite.
- Test isolation: no `migrate reset`, no drops, no arbitrary deletes. Integration tests use uniquely prefixed records (`Tst…` + timestamp) and delete only what they created (farmer delete cascades its listings). There is no dedicated test database yet — point `DATABASE_URL` at a dev/test database, not production.
- Synthetic market-price rows used by tests are clearly labelled synthetic (`source: "synthetic-test"`) — no authentic government dataset ships with this repo.

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

## Crop Listing API (B1 Task 3 + 3.5)

Bridge between Farmer and the future market/mandi + matching systems. Every listing belongs to an existing farmer (`farmerId`); mandi/market-price integration is NOT implemented yet.

Listings store a farmer-defined acceptable selling-price range:

- `minExpectedPrice` / `maxExpectedPrice` (both required on create, both `>= 0`, `min <= max`)
- Future market-price functionality will show mandi min/modal/max as context so the farmer can pick this range; no mandi validation is enforced yet.

Requires live `DATABASE_URL` (endpoints return `503` when unconfigured).

| Method | Endpoint | Success |
|---|---|---|
| `POST` | `/api/crop-listings` | `201 { success: true, data }` |
| `GET` | `/api/crop-listings?page=1&limit=20` | `200 { success: true, data, pagination }` |
| `GET` | `/api/crop-listings/:id` | `200 { success: true, data }` (includes limited `farmer: { id, name, phone, village, district, state }`) |
| `PATCH` | `/api/crop-listings/:id` | `200 { success: true, data }` |
| `DELETE` | `/api/crop-listings/:id` | `200 { success: true, data }` (farmer untouched) |

- Create accepts only `farmerId, cropName, quantity, unit, minExpectedPrice, maxExpectedPrice, availableFrom?, status?, latitude?, longitude?` (`status` defaults to `OPEN`). Update accepts the same fields, all optional; changing `farmerId` re-verifies the new farmer. Partial price updates are checked against the stored record so `min <= max` always holds. `id/createdAt/updatedAt` and unknown fields (e.g. the old `expectedPrice`, `marketPrice`, `buyerId`) are rejected.
- Validation: `quantity > 0`, `minExpectedPrice >= 0`, `maxExpectedPrice >= 0`, `minExpectedPrice <= maxExpectedPrice` (`min = max` allowed, `0/0` allowed), `status ∈ OPEN | MATCHED | IN_PROGRESS | COMPLETED | CANCELLED | EXPIRED`, `availableFrom` valid date, lat ±90 / lng ±180.
- Pagination: defaults `page=1, limit=20`, max `limit=100`; invalid values → `400`; stable `createdAt desc` ordering.
- Errors: `400` validation, `404` listing/farmer not found, `409` unique conflict, via central error handler (no raw Prisma errors).

Example create:

```bash
curl -X POST http://localhost:8000/api/crop-listings \
  -H "Content-Type: application/json" \
  -d '{"farmerId":"<farmer-id>","cropName":"Onion","quantity":1000,"unit":"kg","minExpectedPrice":24,"maxExpectedPrice":28}'
```

## Market Prices — government mandi context (B1 Task 4)

Mandi prices are MARKET CONTEXT, not the farmer's selling range. A mandi may quote min ₹21 / modal ₹25 / max ₹29 per quintal while a farmer independently lists min ₹24 / max ₹28. Nothing forces the farmer range inside the mandi range; `crop_listings.minExpectedPrice/maxExpectedPrice` semantics are unchanged.

### Source inspected

No government dataset file ships with this repository (searched for CSV/XLSX/JSON data; only references exist: `docs/API_CONTRACT_M5.md` "Automated Mandi Scraper Sync … TODO: [Backend Team]" and frontend mock mandis, which are computed quotes, not raw records). The normalized model follows the actual Agmarknet daily-price record layout from data.gov.in ("Current Daily Price of Various Commodities from Various Markets (Mandi)": `State, District, Market, Commodity, Variety, Grade, Arrival_Date, Min_Price, Max_Price, Modal_Price`, Rs/quintal). Ingestion below was tested with representative Agmarknet-shaped rows — clearly synthetic, not real government data.

### Normalized model (`market_prices`)

`id, commodity, variety?, grade?, market, district?, state, minPrice, maxPrice, modalPrice?, unit (default "quintal"), observedAt (arrival date, UTC midnight), source (default "agmarknet"), sourceRecordId?, createdAt, updatedAt`. Indexes: `(commodity, observedAt)`, `(state, district, observedAt)`, `(market, observedAt)`. No DB unique constraint (the source itself repeats keys via corrections) — dedup lives in the importer.

### Ingestion flow

`parseCsvText` (dependency-free CSV incl. quotes/commas) → `importRecords(rows, { source, chunkSize=500 })`: validate → normalize → in-batch dedup → one batched `findMany OR` lookup per chunk → create / update-on-price-change / duplicate-skip. Returns `{ total, valid, invalid, inserted, updated, duplicates, errors[] }` (up to 25 samples of `{ index, errors }`); nothing is silently discarded.

Normalization rules: trim/collapse whitespace; prices strip `₹`, commas, `Rs`; dates accept `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, ISO; unit maps quintal/qtl, kg, tonne variants (default quintal); reject missing commodity/market/state, non-numeric/negative prices, `min > max`, bad dates; tolerate modal outside `[min, max]` (real source anomaly). Dedup key: commodity|variety|grade|market|district|state|day|unit (lowercased). Within one file the last row wins (later rows are treated as corrections); across imports, changed prices update the stored observation while identical rows count as duplicates.

Run it:

```bash
DATABASE_URL="postgresql://..." npm run mandi:import -- ./mandi.csv agmarknet
# or from code:
const { parseCsvText, importRecords } = require('./src/services/marketPriceIngestService');
```

Requires live `DATABASE_URL` (otherwise `503`, never faked).

### API (read-only)

| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/api/market-prices?commodity=&variety=&state=&district=&market=&date=&dateFrom=&dateTo=&page=&limit=` | `200 { success, data, pagination }`; text filters case-insensitive; `date` = single day; `dateFrom>dateTo` → `400` |
| `GET` | `/api/market-prices/context?commodity=&state=&district=&market=&limit=` | `commodity` required; `200 { success, filters, context:{ latestObservedAt, markets, observations, minOfMinPrice, maxOfMaxPrice, avgModalPrice }, records }`; no rows → `404` |

Example:

```bash
curl "http://localhost:8000/api/market-prices?commodity=Onion&state=Maharashtra&page=1&limit=20"
curl "http://localhost:8000/api/market-prices/context?commodity=Onion&state=Maharashtra"
```

### Known limitations

- No live Agmarknet fetch/scheduler yet (manual CSV/API-row import only).
- Same-key correction rows update prices in place; history of corrections is not kept.
- Text search is `contains`-insensitive (no full-text index yet).
- Buyer matching, offers, logistics, maps, weather, auth are out of scope.

## Notes for next modules

- Matching, maps, auth are NOT implemented here — only schema + validation placeholders.
- Use `validateBody(schema)` from `src/utils/validate.js` in future POST/PUT routes.
