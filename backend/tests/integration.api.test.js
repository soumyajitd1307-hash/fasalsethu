// Integration tests: live HTTP API against the Express app (localhost only).
// - Health + unknown-route tests always run (no DB needed).
// - DB tests are SKIPPED (reported BLOCKED) when DATABASE_URL is unset.
// - With DATABASE_URL set, the DB must be migrated; tests use uniquely
//   prefixed records and clean up only what they created (no resets/drops).
// - Synthetic market rows are clearly synthetic, never "government data".
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

let baseUrl = '';
let server = null;
const created = { farmers: [], marketIds: [] };

function url(path) {
  return `${baseUrl}${path}`;
}

async function api(method, path, body) {
  const res = await fetch(url(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// Raw Prisma/database internals must never reach API clients.
function assertNoLeak(json, label) {
  assert.ok(json && typeof json === 'object', `${label}: expected JSON body`);
  assert.ok(!('code' in json), `${label}: leaked Prisma error code`);
  assert.match(JSON.stringify(json), /^((?!P[12]\d{3}).)*$/s, `${label}: leaked Prisma code`);
}

function tvar(name) {
  return `${name}${TS}`;
}

before(async () => {
  // eslint-disable-next-line global-require
  const app = require('../src/app');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  if (HAVE_DB) {
    // Fail loudly if DATABASE_URL is set but the DB is unreachable/unmigrated.
    const health = await api('GET', '/api/health');
    assert.equal(health.status, 200, 'server must boot with DATABASE_URL set');
    assert.equal(health.json.database.connected, true, 'database must be reachable (run db:migrate first)');
  }
});

after(async () => {
  if (HAVE_DB) {
    try {
      // eslint-disable-next-line global-require
      const { getPrisma } = require('../src/config/database');
      const prisma = getPrisma();
      if (created.marketIds.length > 0) {
        await prisma.marketPrice.deleteMany({ where: { id: { in: created.marketIds } } });
      }
      for (const id of created.farmers) {
        await prisma.farmer.deleteMany({ where: { id } }); // cascades crop listings
      }
      await prisma.$disconnect();
    } catch (err) {
      console.warn(`cleanup warning (test data may remain): ${err.message}`);
    }
  }
  if (server) {
    server.close();
    await once(server, 'close').catch(() => {});
  }
});

describe('health', () => {
  test('GET /api/health returns ok shape', async () => {
    const { status, json } = await api('GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(json.status, 'ok');
    assert.ok(typeof json.message === 'string');
    assert.ok(typeof json.timestamp === 'string');
    assert.ok(typeof json.uptimeSeconds === 'number');
    assert.ok(json.database && typeof json.database.connected === 'boolean');
    if (HAVE_DB) assert.equal(json.database.connected, true);
  });
});

describe('unknown routes', () => {
  test('GET /api/nope returns central 404 JSON', async () => {
    const { status, json } = await api('GET', '/api/nope');
    assert.equal(status, 404);
    assert.equal(json.status, 'error');
    assertNoLeak(json, 'unknown route');
  });

  test('GET /api/market-prices/nope returns 404 JSON', async () => {
    const { status, json } = await api('GET', '/api/market-prices/nope');
    assert.equal(status, 404);
    assert.equal(json.status, 'error');
    assertNoLeak(json, 'unknown market-price route');
  });
});

describe('farmer CRUD', { skip: SKIP_DB }, () => {
  let farmerId = '';
  const email = `tst-${TS}@example.com`;
  const phone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  test('creates a farmer with DB defaults (201)', async () => {
    const { status, json } = await api('POST', '/api/farmers', { name: 'Test Farmer', phone, email });
    assert.equal(status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.kycStatus, 'PENDING');
    assert.equal(json.data.trustScore, 0);
    farmerId = json.data.id;
    created.farmers.push(farmerId);
  });

  test('rejects invalid payloads (400)', async () => {
    const bad = await api('POST', '/api/farmers', { phone });
    assert.equal(bad.status, 400);
    assertNoLeak(bad.json, 'farmer validation');
  });

  test('rejects client-controlled trustScore/id (400)', async () => {
    const withScore = await api('POST', '/api/farmers', { name: 'X2', phone, trustScore: 99 });
    assert.equal(withScore.status, 400);
    const withId = await api('POST', '/api/farmers', { name: 'X2', phone, id: 'hack' });
    assert.equal(withId.status, 400);
  });

  test('duplicate email returns clean 409', async () => {
    const dup = await api('POST', '/api/farmers', { name: 'Dup', phone, email });
    assert.equal(dup.status, 409);
    assertNoLeak(dup.json, 'duplicate email');
  });

  test('lists with pagination; invalid page rejected', async () => {
    const list = await api('GET', '/api/farmers?page=1&limit=5');
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json.data));
    assert.ok(list.json.pagination.total >= 1);
    const badPage = await api('GET', '/api/farmers?page=0');
    assert.equal(badPage.status, 400);
  });

  test('gets one; missing returns 404 without leaks', async () => {
    const one = await api('GET', `/api/farmers/${farmerId}`);
    assert.equal(one.status, 200);
    assert.equal(one.json.data.id, farmerId);
    const miss = await api('GET', '/api/farmers/does-not-exist');
    assert.equal(miss.status, 404);
    assertNoLeak(miss.json, 'missing farmer');
  });

  test('updates allowed fields; rejects trustScore', async () => {
    const upd = await api('PATCH', `/api/farmers/${farmerId}`, { district: 'Nashik' });
    assert.equal(upd.status, 200);
    assert.equal(upd.json.data.district, 'Nashik');
    const bad = await api('PATCH', `/api/farmers/${farmerId}`, { trustScore: 100 });
    assert.equal(bad.status, 400);
  });

  test('deletes and confirms gone', async () => {
    const del = await api('DELETE', `/api/farmers/${farmerId}`);
    assert.equal(del.status, 200);
    created.farmers = created.farmers.filter((id) => id !== farmerId);
    const gone = await api('GET', `/api/farmers/${farmerId}`);
    assert.equal(gone.status, 404);
  });
});

describe('crop listing CRUD (price range)', { skip: SKIP_DB }, () => {
  let farmerId = '';
  let listingId = '';

  test('setup: farmer for listings', async () => {
    const phone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const res = await api('POST', '/api/farmers', { name: 'Listing Owner', phone });
    assert.equal(res.status, 201);
    farmerId = res.json.data.id;
    created.farmers.push(farmerId);
  });

  test('creates a listing with min/max range (201)', async () => {
    const { status, json } = await api('POST', '/api/crop-listings', {
      farmerId, cropName: 'Onion', quantity: 100, unit: 'quintal', minExpectedPrice: 24, maxExpectedPrice: 28,
    });
    assert.equal(status, 201);
    assert.equal(json.data.minExpectedPrice, 24);
    assert.equal(json.data.maxExpectedPrice, 28);
    assert.ok(!('expectedPrice' in json.data));
    listingId = json.data.id;
  });

  test('rejects ghost farmer (404), bad quantity/coords/status, min>max (400)', async () => {
    const ghost = await api('POST', '/api/crop-listings', {
      farmerId: 'ghost', cropName: 'Onion', quantity: 1, unit: 'kg', minExpectedPrice: 1, maxExpectedPrice: 2,
    });
    assert.equal(ghost.status, 404);
    assertNoLeak(ghost.json, 'ghost farmer');
    const base = { farmerId, cropName: 'Onion', unit: 'kg', minExpectedPrice: 1, maxExpectedPrice: 2 };
    for (const body of [
      { ...base, quantity: 0 }, { ...base, quantity: -3 },
      { ...base, quantity: 1, latitude: 100 }, { ...base, quantity: 1, status: 'SOLD' },
      { ...base, quantity: 1, minExpectedPrice: 9, maxExpectedPrice: 2 },
      { ...base, quantity: 1, expectedPrice: 5 },
    ]) {
      const r = await api('POST', '/api/crop-listings', body);
      assert.equal(r.status, 400);
      assertNoLeak(r.json, 'listing validation');
    }
  });

  test('lists with pagination and embeds farmer on GET one', async () => {
    const list = await api('GET', '/api/crop-listings?page=1&limit=10');
    assert.equal(list.status, 200);
    assert.ok(list.json.pagination.total >= 1);
    const one = await api('GET', `/api/crop-listings/${listingId}`);
    assert.equal(one.status, 200);
    assert.equal(one.json.data.farmer.name, 'Listing Owner');
    const miss = await api('GET', '/api/crop-listings/nope');
    assert.equal(miss.status, 404);
    assertNoLeak(miss.json, 'missing listing');
  });

  test('PATCH min valid vs stored max; PATCH max below stored min rejected', async () => {
    const okMin = await api('PATCH', `/api/crop-listings/${listingId}`, { minExpectedPrice: 26 });
    assert.equal(okMin.status, 200);
    assert.equal(okMin.json.data.minExpectedPrice, 26);
    const badMax = await api('PATCH', `/api/crop-listings/${listingId}`, { maxExpectedPrice: 22 });
    assert.equal(badMax.status, 400);
    const okBoth = await api('PATCH', `/api/crop-listings/${listingId}`, { minExpectedPrice: 26, maxExpectedPrice: 30 });
    assert.equal(okBoth.status, 200);
  });

  test('deletes the listing', async () => {
    const del = await api('DELETE', `/api/crop-listings/${listingId}`);
    assert.equal(del.status, 200);
    const gone = await api('GET', `/api/crop-listings/${listingId}`);
    assert.equal(gone.status, 404);
  });
});

describe('market price import + API (synthetic data only)', { skip: SKIP_DB }, () => {
  const crop = tvar('TstCrop');
  const mktA = tvar('TstMandiA');
  const mktB = tvar('TstMandiB');
  const rows = [
    { State: 'TstState', District: 'TstDist', Market: mktA, Commodity: crop, Variety: 'Red', Grade: 'FAQ', Arrival_Date: '01/02/2024', Min_Price: '1,200', Max_Price: '1,500', Modal_Price: '1350' },
    { State: 'TstState', District: 'TstDist', Market: mktB, Commodity: crop, Arrival_Date: '2024-02-01', Min_Price: 1180, Max_Price: 1480, Modal_Price: 1330 },
    { State: 'TstState', District: 'TstDist', Market: mktA, Commodity: crop, Variety: 'Red', Grade: 'FAQ', Arrival_Date: '01/02/2024', Min_Price: '1,200', Max_Price: '1,500', Modal_Price: '1350' },
  ];

  test('import inserts, dedupes in-file, reports stats', async () => {
    // eslint-disable-next-line global-require
    const { importRecords } = require('../src/services/marketPriceIngestService');
    const stats = await importRecords(rows, { source: 'synthetic-test' });
    assert.deepEqual(
      { total: stats.total, valid: stats.valid, invalid: stats.invalid, inserted: stats.inserted, duplicates: stats.duplicates },
      { total: 3, valid: 3, invalid: 0, inserted: 2, duplicates: 1 }
    );
  });

  test('re-import is all duplicates; correction updates', async () => {
    // eslint-disable-next-line global-require
    const { importRecords } = require('../src/services/marketPriceIngestService');
    const again = await importRecords(rows, { source: 'synthetic-test' });
    assert.equal(again.inserted, 0);
    assert.equal(again.duplicates, 3);
    const fixed = await importRecords(
      [{ State: 'TstState', District: 'TstDist', Market: mktA, Commodity: crop, Variety: 'Red', Grade: 'FAQ', Arrival_Date: '01/02/2024', Min_Price: 1200, Max_Price: 1600, Modal_Price: 1400 }],
      { source: 'synthetic-test' }
    );
    assert.equal(fixed.updated, 1);
  });

  test('invalid rows are rejected and never inserted', async () => {
    // eslint-disable-next-line global-require
    const { importRecords } = require('../src/services/marketPriceIngestService');
    const stats = await importRecords(
      [
        { State: 'TstState', Market: mktA, Min_Price: 1, Max_Price: 2, Arrival_Date: '01/02/2024' },
        { State: 'TstState', District: 'D', Market: mktA, Commodity: crop, Arrival_Date: 'bad', Min_Price: 1, Max_Price: 2 },
        { State: 'TstState', District: 'D', Market: mktA, Commodity: crop, Arrival_Date: '01/02/2024', Min_Price: 9, Max_Price: 2 },
      ],
      { source: 'synthetic-test' }
    );
    assert.equal(stats.invalid, 3);
    assert.equal(stats.inserted, 0);
    assert.equal(stats.errors.length, 3);
  });

  test('list filters, pagination and inverted range', async () => {
    const byCrop = await api('GET', `/api/market-prices?commodity=${crop.toLowerCase()}`);
    assert.equal(byCrop.status, 200);
    assert.equal(byCrop.json.pagination.total, 2);
    for (const id of byCrop.json.data.map((r) => r.id)) created.marketIds.push(id);
    const combo = await api('GET', `/api/market-prices?commodity=${crop}&state=TstState&district=TstDist&market=${mktA}&variety=Red&date=2024-02-01&dateFrom=2024-02-01&dateTo=2024-02-01`);
    assert.equal(combo.json.pagination.total, 1);
    const page = await api('GET', `/api/market-prices?commodity=${crop}&page=2&limit=1`);
    assert.equal(page.json.data.length, 1);
    assert.equal(page.json.pagination.totalPages, 2);
    const badRange = await api('GET', '/api/market-prices?dateFrom=2024-02-05&dateTo=2024-02-01');
    assert.equal(badRange.status, 400);
    const badLimit = await api('GET', '/api/market-prices?limit=101');
    assert.equal(badLimit.status, 400);
  });

  test('context math is correct; miss is 404', async () => {
    const ctx = await api('GET', `/api/market-prices/context?commodity=${crop}&state=TstState`);
    assert.equal(ctx.status, 200);
    assert.equal(ctx.json.context.latestObservedAt.slice(0, 10), '2024-02-01');
    assert.equal(ctx.json.context.markets, 2);
    assert.equal(ctx.json.context.observations, 2);
    assert.equal(ctx.json.context.minOfMinPrice, 1180);
    assert.equal(ctx.json.context.maxOfMaxPrice, 1600);
    assert.equal(ctx.json.context.avgModalPrice, 1365);
    const noCommodity = await api('GET', '/api/market-prices/context?state=TstState');
    assert.equal(noCommodity.status, 400);
    const miss = await api('GET', `/api/market-prices/context?commodity=${tvar('Nope')}`);
    assert.equal(miss.status, 404);
    assertNoLeak(miss.json, 'context miss');
  });
});
