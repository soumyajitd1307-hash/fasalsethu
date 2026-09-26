# FasalSethu Backend (foundation)

Express + PostgreSQL (Prisma) backend. Frontend is untouched — this service is independent.

Product terminology: **Buyer = Retailer**. The database/API models keep the names `Buyer` / `BuyerRequirement` (a `BuyerRequirement` is a retailer's crop purchasing requirement). No retailer matching is implemented yet — do not rename these models casually.

## Structure

```text
backend/
  prisma/schema.prisma      # Farmer, Buyer, CropListing, BuyerRequirement, MarketPrice, Deal, Notification
  prisma/migrations/        # 2 migrations: init marketplace schema, deal + notification tables
  src/
    config/env.js           # PORT / DATABASE_URL / CORS_ORIGIN / Auth0 issuer+audience
    config/database.js      # Prisma singleton + checkConnection()
    controllers/            # thin controllers per entity (farmer, cropListing, buyer, …, deal, notification)
    routes/                 # one router per entity, mounted in app.js
    services/               # business logic (incl. dealService, notificationService, offerAdapter)
    middleware/             # auth.js (Auth0/JWKS), errorHandler.js, notFound.js
    utils/validate.js       # zod schemas
    app.js                  # express app (cors, json, /api/health, 404, errors)
    server.js               # listen + graceful shutdown
  tests/                    # node:test suites (unit.*, integration.*, helpers/jwt-test-server.js)
```

## Prerequisites

- Node.js >= 18
- PostgreSQL 14+ (local or hosted). No live DB is required to boot — `/api/health` reports `database.configured=false` when `DATABASE_URL` is unset.

## Install

```bash
cd backend
npm install
```

## Local setup (clean checkout)

Verified end to end on Windows/macOS/Linux with a local PostgreSQL. Run every command from the `backend/` directory.

```bash
# 1. dependencies (also generates the Prisma client via @prisma/client postinstall)
npm install

# 2. a database to work against (once per machine).
#    Create it as UTF8: notification text contains ₹, and a database created
#    from a non-UTF8 template silently rejects those rows.
createdb -E UTF8 -T template0 fasalsethu
# or: psql -U postgres -c "CREATE DATABASE fasalsethu ENCODING 'UTF8' TEMPLATE template0;"

# 3. configuration
cp .env.example .env           # then set DATABASE_URL (and PORT if 8000 is taken)

# 4. schema: validate, generate the client, apply the committed migrations
npm run db:validate
npm run db:generate
npm run db:deploy              # applies both existing migrations; safe to re-run

# 5. start (development, hot reload)
npm run dev                    # or: npm start  (plain node, no reload)

# 6. verify
curl http://localhost:8000/api/health
```

`GET /api/health` must report `"database": { "configured": true, "connected": true }`. If it reports `connected: false`, the `reason` field says why (wrong port, database not created, migrations not applied).

Expected base URL: `http://localhost:8000` (override with `PORT`).

Nothing above creates, drops or resets an existing database — `db:deploy` only applies pending migrations. `npm run db:migrate` (`prisma migrate dev`) is only needed when you intentionally change `schema.prisma`; it may prompt and requires permission to create a shadow database, so it is not part of first-time setup.

### Environment variables

`.env` is read from `backend/.env`. `.env` files are git-ignored; only `.env.example` is committed. Real environment variables always take precedence over the file.

| Var | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Required for any database feature** (the server still boots without it) | — | PostgreSQL connection string used by Prisma, e.g. `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`. Without it every DB endpoint returns `503` and health reports `configured: false`. |
| `PORT` | Optional | `8000` | TCP port the Express app listens on. |
| `CORS_ORIGIN` | Optional | `http://localhost:5173` | Comma-separated list of allowed browser origins. Must include the Vite dev server origin for local frontend work; unknown origins get no CORS headers. |
| `NODE_ENV` | Optional | `development` | `development` includes stack traces in API error responses; use `production` when deployed. |
| `AUTH0_ISSUER_BASE_URL` | Optional — **required only to call authenticated B3 endpoints** | — | Auth0 tenant base URL (e.g. `https://TENANT.us.auth0.com/`). Its `/.well-known/jwks.json` provides the RS256 signing keys. Unset ⇒ `/api/deals/*` and `/api/notifications/*` fail closed with `503`. |
| `AUTH0_AUDIENCE` | Optional — recommended alongside the issuer | — | Expected API audience claim. When set, tokens with a different `aud` are rejected with `401`. |

There are no test-only environment variables. Tests read `DATABASE_URL` from the real environment and skip (report `BLOCKED`) when it is unset; test JWTs are minted in-process against a local JWKS server, so no Auth0 tenant or secret is needed to run the suite.

## Configure

```bash
cp .env.example .env
# edit .env: set DATABASE_URL (and PORT only if you need a different port)
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
# apply the committed migrations (idempotent; use this for setup and production)
npm run db:deploy
# create a NEW migration after editing schema.prisma (prompts; needs shadow-DB rights)
npm run db:migrate
# optional GUI
npm run db:studio
```

Tables: `farmers`, `buyers`, `crop_listings`, `buyer_requirements`, `market_prices`, `deals`, `notifications`. There is intentionally **no** `offers` table (see Deal API below).
Relations: `Farmer 1—N CropListing`, `Buyer 1—N BuyerRequirement`, `Farmer/Buyer 1—N Deal`, `Deal 1—N Notification` (FK cascade delete).
Committed migrations: `20260925130308_init_marketplace_schema` (farmers, buyers, crop_listings, buyer_requirements, market_prices) and `20260925204349_add_deal_notification_tables` (deals, notifications). Both verified against live PostgreSQL on a fresh database.

## Start

```bash
npm run dev   # nodemon, development
npm start     # production
```

Backend port: `http://localhost:8000` (or `$PORT`). The server binds the configured port on all interfaces, so platforms can route to it; `npm start` runs plain `node` (no nodemon) for production. `SIGINT`/`SIGTERM` trigger a graceful shutdown that closes the HTTP server and the Prisma connection.

### Local API smoke test

With the server running, this exercises every layer (no Auth0 tenant needed):

```bash
curl http://localhost:8000/api/health                                  # 200, database.connected = true
curl http://localhost:8000/api/farmers                                 # 200 B1 read
curl http://localhost:8000/api/crop-listings                          # 200 B1 read
curl -X POST http://localhost:8000/api/farmers -H 'content-type: application/json' \
  -d '{"name":"Local Dev","phone":"+919000000001","email":"local-dev@example.com"}'   # 201 B1 write
curl "http://localhost:8000/api/matching/crop-listings/<listingId>"    # 200 B2 read
curl "http://localhost:8000/api/price-discovery/<listingId>"           # 200 B2 read
curl http://localhost:8000/api/deals                                  # 503 (Auth0 unset) or 401 (no token)
curl -X POST http://localhost:8000/api/deals -H 'content-type: application/json' \
  -d '{"offerId":"anything"}'                                          # 503 OFFER_PROVIDER_NOT_CONFIGURED once Auth0 is set
```

Expected behaviour worth knowing: the server always starts, even with no database — `/api/health` then reports `configured: false` and database endpoints return `503` instead of crashing. `/api/deals/*` and `/api/notifications/*` return `503` while `AUTH0_ISSUER_BASE_URL` is unset (fail closed), and `401` once it is set but no valid Bearer token is sent. `POST /api/deals` additionally returns `503` because no Offer provider is registered yet (see Deal API below).

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Health says `connected: false`, `Can't reach database server` | PostgreSQL is not running, or `DATABASE_URL` has the wrong host/port | Start PostgreSQL; re-check the URL |
| Health says `configured: false` | `DATABASE_URL` is not set in the environment or `backend/.env` | Copy `.env.example` → `.env` and set it |
| `P1012 … Environment variable not found: DATABASE_URL` from a Prisma command | Prisma CLI ran without the variable | Run it from `backend/`, or export `DATABASE_URL` first |
| Health connects but every DB call returns an empty/erroring result | Migrations not applied | `npm run db:deploy` |
| Deal/notification rows are missing, or a test fails with `0 !== 1` on notification counts | Database encoding is not UTF8, so `₹` text is rejected on insert | Recreate the database as UTF8 (step 2 above) |
| `npm test` reports many suites `BLOCKED` | No `DATABASE_URL` in the environment or `backend/.env` | Set it, then re-run |

## Production deployment prerequisites (not yet deployed)

1. Provision managed PostgreSQL; set `DATABASE_URL` (format `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`, `?schema=public` for Prisma).
2. Set `NODE_ENV=production`, `PORT` (or accept the platform default), and `CORS_ORIGIN` to the deployed frontend origin(s).
3. Set `AUTH0_ISSUER_BASE_URL` (e.g. `https://TENANT.us.auth0.com/`) and `AUTH0_AUDIENCE`; without them, deal/notification APIs fail closed with 503.
4. Install + generate + apply migrations once: `npm install`, `npm run db:generate`, `npm run db:deploy` (never `migrate reset` / drops; no seed step exists).
5. Start with `npm start`; verify `GET /api/health` shows `database.connected: true`.
6. No cloud provider, database, or public URL exists yet — nothing here claims otherwise.

## Authentication

- Model: Auth0-style RS256 JWTs verified against a JWKS endpoint (`jose`). No Firebase, no second system.
- `Authorization: Bearer <token>` is the only credential. Signature, issuer (`AUTH0_ISSUER_BASE_URL`), audience (`AUTH0_AUDIENCE`, when set), and expiry are enforced; failures → 401 with no token material leaked.
- `x-user-id` (or any client header) is never identity — requests carrying only headers are rejected.
- Protected (verified JWT required): all `/api/deals/*` and `/api/notifications/*`. Unconfigured Auth0 → 503.
- Public by design: `/`, `/api/health`, all B1/B2 farmer, crop-listing, buyer, requirement, matching, price-discovery, and market-price reads.
- Authorization is separate: history/participant checks compare the verified `sub`/`role` against the resource (`403` on mismatch).

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
npm test                # unit + integration (DB-backed tests need DATABASE_URL)
npm run test:unit       # validation, normalization, auth, matching, offers, deals, notifications
npm run test:integration # live API tests, requires DATABASE_URL
npm run test:b3         # B3 only: offer adapter, deals, notifications
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

## Deal API (B3) and the offer dependency

Deals and in-app notifications are implemented and PostgreSQL-only (no in-memory fallback).

| Method | Endpoint | Notes |
|---|---|---|
| `POST` | `/api/deals` | `201`; body `{ offerId, pickupLocation?, deliveryLocation? }`; one deal per offer (`409` on duplicate) |
| `GET` | `/api/deals?status=&page=&limit=` | `200 { success, data, pagination }` — the caller's own deals only (see Authorization below) |
| `GET` | `/api/deals/summary` | aggregated counts/volume/settled value for the caller's own deals; optional `?farmerId=`/`?buyerId=` must match the caller |
| `GET` | `/api/deals/farmer/:farmerId`, `/api/deals/buyer/:buyerId` | participant history, paginated; owner only |
| `GET` | `/api/deals/:id` | `200`; includes limited farmer/buyer details |
| `PATCH` | `/api/deals/:id/status` | `ACCEPTED → CONFIRMED → IN_PROGRESS → COMPLETED` (`CANCELLED` from any non-terminal state); invalid jump → `400` |
| `PATCH` | `/api/deals/:id/cancel` | records `cancellationReason` |

- `totalAmount = quantity × agreedPrice` is always computed server-side; client totals are ignored. Deal status changes and cancellations emit buyer + farmer notifications.
- All `/api/deals/*` and `/api/notifications/*` routes require a verified Auth0 JWT (see Authentication) and enforce participant/ownership checks (`403` on mismatch). `GET /api/deals/:id`, status updates and cancellation are restricted to the deal's farmer or buyer.

### Authorization on B3 reads

Identity comes **only** from the verified JWT `sub` (see Authentication). There is no
`x-user-id` fallback, and no collection endpoint reads an owner from the query string.

| Caller role | `GET /api/deals`, `/api/deals/summary` | `/api/deals/farmer/:id`, `/api/deals/buyer/:id` |
|---|---|---|
| `farmer` | only deals where they are the farmer | own farmer history; buyer history → `403` |
| `buyer` | only deals where they are the buyer | own buyer history; farmer history → `403` |
| any other role | `403` | `403` |
| `admin` / `system` | all deals (may narrow with `?farmerId=`/`?buyerId=`) | allowed |

- Collection reads are scoped in the service layer (`dealService.resolveOwnerFilter`), not
  only in route middleware, so a new route cannot accidentally expose the whole book of
  business. A `farmerId`/`buyerId` filter naming another participant is rejected with
  `403` rather than silently ignored, and an absent filter means *the caller's own*
  deals — `GET /api/deals/summary` with no parameters is a personal summary, never a
  platform-wide one.
- Notification endpoints (`/api/notifications`, `/unread`, `/read-all`, `/:id/read`) are
  always scoped to `req.user.id`; another user's notification is `403` to list, count or
  mark as read.
- `admin`/`system` are the only cross-participant roles. They are deliberately explicit so
  that operational access stays auditable; no other role can widen its own scope.

### What `offerId` is (and is not)

- A Deal is only created from an **already-accepted offer**. `offerId` is the opaque business key of that accepted offer. It is the duplicate-deal guard (`deals.offer_id` is `UNIQUE`) and is echoed onto the deal's notifications.
- It is **not** a foreign key. There is no `offers` table in this repository, and there is no `OfferService` — none has ever existed on any branch.
- **Neither B1 nor B2 produces offers.** B1 persists crop listings, requirements and mandi prices. B2 (`matchingService`, `priceDiscoveryService`) is read-only: it computes match scores and price comparisons and writes nothing. A match score is not an offer, so matching does not imply one.
- The product flow that produces accepted offers is the **negotiation / connection module** (`docs/API_CONTRACT_M5.md` §4: `PROPOSE_DEAL → COUNTER_OFFER → ACCEPT_DEAL → COMPLETE_DEAL`). That module has its own data model and is not implemented in this backend yet. No backend endpoint creates, reads or accepts an offer, and the frontend does not call an offer API.

### The provider seam (`src/services/offerAdapter.js`)

`offerAdapter` is the integration boundary, not a stub database. The negotiation module registers a real provider:

```js
const { registerOfferProvider } = require('./services/offerAdapter');

registerOfferProvider({
  async getOfferById(offerId) {
    // return the accepted offer, or null when it does not exist
    return { offerId, farmerId, buyerId, cropName, quantity, unit, offeredPrice, status: 'ACCEPTED' };
  },
});
```

`POST /api/deals` then resolves and validates the offer (status must be `ACCEPTED`; `farmerId`/`buyerId` required; `quantity` and price must be positive) and persists the deal.

- **Production safety:** the adapter never fabricates an offer and never falls back to in-memory data. With no provider registered it fails loudly with `503 OFFER_PROVIDER_NOT_CONFIGURED`, so a deployed `POST /api/deals` returns 503 until the negotiation module is wired — it does not invent offers. A registered provider that has no such offer returns `404`; an offer whose status is not `ACCEPTED` returns `400`.
- **Test seam:** the only in-memory offer store (`__setTestOffer` / `__clearTestOffers` / `__resetOfferProvider`) is reachable **only when `NODE_ENV=test`** and throws in every other environment, so no fake offer record can exist in a deployed environment. Unit/integration tests set `process.env.NODE_ENV = 'test'` for this reason.

## Notes for next modules

- Matching (B2), price discovery, deal and notification (B3) APIs, and Auth0 JWT auth **are** implemented; see the sections above.
- Not implemented: the negotiation / connection module that produces accepted offers (`docs/API_CONTRACT_M5.md` §4), logistics/e-way-bill, escrow webhooks, maps, and weather.
- Use `validateBody(schema)` from `src/utils/validate.js` in future POST/PUT routes.
