const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createHarness } = require('./helpers/jwt-test-server');
const { __setTestOffer, __clearTestOffers } = require('../src/services/offerAdapter');

// Deal persistence is PostgreSQL-only (no in-memory fallback), so these
// tests need a migrated database and use real persisted farmer/buyer IDs.
// Requests carry real RS256 Bearer tokens minted against a local test JWKS;
// plain x-user-id headers alone are (correctly) rejected with 401.
const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

const created = { farmers: [], buyers: [], userIds: [] };

let app;
let farmerService;
let buyerService;
let harness;

async function makeParties(tag) {
  const phoneF = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const phoneB = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const farmer = await farmerService.createFarmer({
    name: `API Deal Farmer ${tag}`,
    phone: phoneF,
    email: `api-deal-f-${tag}-${TS}@example.com`,
  });
  const buyer = await buyerService.createBuyer({
    name: `API Deal Buyer ${tag}`,
    phone: phoneB,
    email: `api-deal-b-${tag}-${TS}@example.com`,
  });
  created.farmers.push(farmer.id);
  created.buyers.push(buyer.id);
  created.userIds.push(farmer.id, buyer.id);
  return { farmerId: farmer.id, buyerId: buyer.id };
}

function authHeaders(userId, role) {
  return harness
    .mint({ sub: userId, role })
    .then((token) => ({ Authorization: `Bearer ${token}` }));
}

// Any authenticated identity (no participant check on these routes).
async function anyAuthHeaders() {
  const token = await harness.mint({ sub: 'any-tester', role: 'farmer' });
  return { Authorization: `Bearer ${token}` };
}

describe('B3 Deal & Notification API Integration Tests', { skip: SKIP_DB }, () => {
  let server;
  let baseUrl;

  before(async () => {
    harness = await createHarness();
    harness.applyEnv();
    // Require AFTER auth env is set so config picks up the test issuer.
    app = require('../src/app');
    farmerService = require('../src/services/farmerService');
    buyerService = require('../src/services/buyerService');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    try {
      const { getPrisma } = require('../src/config/database');
      const prisma = getPrisma();
      if (created.userIds.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
      }
      for (const id of created.farmers) {
        await prisma.farmer.deleteMany({ where: { id } }); // cascades deals
      }
      for (const id of created.buyers) {
        await prisma.buyer.deleteMany({ where: { id } });
      }
      await prisma.$disconnect();
    } catch (err) {
      console.warn(`cleanup warning (test data may remain): ${err.message}`);
    }
    await new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
    if (harness) await harness.close();
  });

  beforeEach(() => {
    __clearTestOffers();
  });

  async function api(method, path, body = null, headers = {}) {
    const opts = {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, opts);
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  function assertNoLeak(json, label) {
    assert.ok(json && typeof json === 'object', `${label}: expected JSON body`);
    assert.ok(!('code' in json), `${label}: leaked Prisma error code`);
    assert.match(JSON.stringify(json), /^((?!P[12]\d{3}).)*$/s, `${label}: leaked Prisma code`);
  }

  test('1. POST /api/deals creates a deal from an accepted offer and calculates totalAmount', async () => {
    const { farmerId, buyerId } = await makeParties('A1');
    __setTestOffer({
      offerId: `OFFER-001-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Nashik Red Onion',
      quantity: 500,
      offeredPrice: 28,
      status: 'ACCEPTED',
    });

    const res = await api('POST', '/api/deals', {
      offerId: `OFFER-001-${TS}`,
      pickupLocation: 'Lasalgaon Mandi Yard',
      deliveryLocation: 'Vashi Warehouse Hub',
    }, await anyAuthHeaders());

    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.offerId, `OFFER-001-${TS}`);
    assert.equal(res.json.data.farmerId, farmerId);
    assert.equal(res.json.data.buyerId, buyerId);
    assert.equal(res.json.data.quantity, 500);
    assert.equal(res.json.data.agreedPrice, 28);
    // 500 * 28 = 14000
    assert.equal(res.json.data.totalAmount, 14000);
    assert.equal(res.json.data.status, 'ACCEPTED');
  });

  test('2. POST /api/deals rejects if offer does not exist (404)', async () => {
    const res = await api('POST', '/api/deals', { offerId: 'GHOST-OFFER' }, await anyAuthHeaders());
    assert.equal(res.status, 404);
    assert.match(res.json.message, /Offer not found/);
  });

  test('3. POST /api/deals rejects if offer is not accepted (400)', async () => {
    const { farmerId, buyerId } = await makeParties('A3');
    __setTestOffer({
      offerId: `OFFER-REJECTED-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Wheat',
      quantity: 100,
      offeredPrice: 20,
      status: 'REJECTED',
    });

    const res = await api('POST', '/api/deals', { offerId: `OFFER-REJECTED-${TS}` }, await anyAuthHeaders());
    assert.equal(res.status, 400);
    assert.match(res.json.message, /must be 'ACCEPTED'/);
  });

  test('4. POST /api/deals duplicate deal protection rejects second creation attempt (409 Conflict)', async () => {
    const { farmerId, buyerId } = await makeParties('A4');
    __setTestOffer({
      offerId: `OFFER-DUP-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Potato',
      quantity: 250,
      offeredPrice: 16,
      status: 'ACCEPTED',
    });

    const first = await api('POST', '/api/deals', { offerId: `OFFER-DUP-${TS}` }, await anyAuthHeaders());
    assert.equal(first.status, 201);

    const second = await api('POST', '/api/deals', { offerId: `OFFER-DUP-${TS}` }, await anyAuthHeaders());
    assert.equal(second.status, 409);
    assert.match(second.json.message, /Deal already exists/);
    assertNoLeak(second.json, 'duplicate deal');
  });

  test('5. GET /api/deals/:id retrieves single deal details', async () => {
    const { farmerId, buyerId } = await makeParties('A5');
    __setTestOffer({
      offerId: `OFFER-GET-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Soybean',
      quantity: 50,
      offeredPrice: 48,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: `OFFER-GET-${TS}` }, await anyAuthHeaders());
    const dealId = created.json.data.id;

    const res = await api('GET', `/api/deals/${dealId}`, null, await authHeaders(farmerId, 'farmer'));
    assert.equal(res.status, 200);
    assert.equal(res.json.data.id, dealId);
    assert.equal(res.json.data.cropName, 'Soybean');
  });

  test('6. PATCH /api/deals/:id/status lifecycle: CONFIRMED -> IN_PROGRESS -> COMPLETED', async () => {
    const { farmerId, buyerId } = await makeParties('A6');
    __setTestOffer({
      offerId: `OFFER-STATUS-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Cotton',
      quantity: 80,
      offeredPrice: 70,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: `OFFER-STATUS-${TS}` }, await anyAuthHeaders());
    const dealId = created.json.data.id;
    const party = await authHeaders(farmerId, 'farmer');

    // 1. CONFIRMED
    const r1 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'CONFIRMED' }, party);
    assert.equal(r1.status, 200);
    assert.equal(r1.json.data.status, 'CONFIRMED');

    // 2. IN_PROGRESS
    const r2 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'IN_PROGRESS' }, party);
    assert.equal(r2.status, 200);
    assert.equal(r2.json.data.status, 'IN_PROGRESS');

    // 3. COMPLETED
    const r3 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'COMPLETED' }, party);
    assert.equal(r3.status, 200);
    assert.equal(r3.json.data.status, 'COMPLETED');
    assert.ok(r3.json.data.completedAt);
  });

  test('7. PATCH /api/deals/:id/status rejects invalid transitions (400)', async () => {
    const { farmerId, buyerId } = await makeParties('A7');
    __setTestOffer({
      offerId: `OFFER-INVALID-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Tomato',
      quantity: 100,
      offeredPrice: 20,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: `OFFER-INVALID-${TS}` }, await anyAuthHeaders());
    const dealId = created.json.data.id;

    // Direct jump ACCEPTED -> COMPLETED is forbidden
    const bad = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'COMPLETED' }, await authHeaders(farmerId, 'farmer'));
    assert.equal(bad.status, 400);
    assert.match(bad.json.message, /Invalid status transition/);
  });

  test('8. PATCH /api/deals/:id/cancel cancels deal and records reason', async () => {
    const { farmerId, buyerId } = await makeParties('A8');
    __setTestOffer({
      offerId: `OFFER-CANCEL-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Maize',
      quantity: 120,
      offeredPrice: 19,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: `OFFER-CANCEL-${TS}` }, await anyAuthHeaders());
    const dealId = created.json.data.id;

    const res = await api('PATCH', `/api/deals/${dealId}/cancel`, {
      reason: 'Adverse weather damaged farm produce',
    }, await authHeaders(farmerId, 'farmer'));
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, 'CANCELLED');
    assert.equal(res.json.data.cancellationReason, 'Adverse weather damaged farm produce');
  });

  test('9. Farmer can retrieve own deals: GET /api/deals/farmer/:farmerId', async () => {
    const { farmerId, buyerId } = await makeParties('A9');
    __setTestOffer({
      offerId: `OFFER-FARMER-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Rice',
      quantity: 200,
      offeredPrice: 32,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: `OFFER-FARMER-${TS}` }, await anyAuthHeaders());

    const res = await api('GET', `/api/deals/farmer/${farmerId}`, null, await authHeaders(farmerId, 'farmer'));
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 1);
    assert.equal(res.json.data[0].farmerId, farmerId);
  });

  test('10. Buyer can retrieve own deals: GET /api/deals/buyer/:buyerId', async () => {
    const { farmerId, buyerId } = await makeParties('A10');
    __setTestOffer({
      offerId: `OFFER-BUYER-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Wheat',
      quantity: 400,
      offeredPrice: 24,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: `OFFER-BUYER-${TS}` }, await anyAuthHeaders());

    const res = await api('GET', `/api/deals/buyer/${buyerId}`, null, await authHeaders(buyerId, 'buyer'));
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 1);
    assert.equal(res.json.data[0].buyerId, buyerId);
  });

  test('11. Unauthorized access to another user deals is rejected (403 Forbidden)', async () => {
    // Impostor farmer trying to spy on another farmer's deals
    const { farmerId } = await makeParties('A11');
    const impostorAuth = await authHeaders('IMPOSTOR-FARMER', 'farmer');
    const res = await api('GET', `/api/deals/farmer/${farmerId}`, null, impostorAuth);
    assert.equal(res.status, 403);
    assert.match(res.json.message, /Access denied/);
  });

  test('12. Deal creation automatically creates notifications for both parties', async () => {
    const { farmerId, buyerId } = await makeParties('A12');
    __setTestOffer({
      offerId: `OFFER-NOTIFS-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Sunflower',
      quantity: 60,
      offeredPrice: 55,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: `OFFER-NOTIFS-${TS}` }, await anyAuthHeaders());

    const farmerNotifs = await api('GET', '/api/notifications', null, await authHeaders(farmerId, 'farmer'));
    assert.equal(farmerNotifs.status, 200);
    assert.equal(farmerNotifs.json.data.length, 1);
    assert.equal(farmerNotifs.json.data[0].userId, farmerId);

    const buyerNotifs = await api('GET', '/api/notifications', null, await authHeaders(buyerId, 'buyer'));
    assert.equal(buyerNotifs.status, 200);
    assert.equal(buyerNotifs.json.data.length, 1);
    assert.equal(buyerNotifs.json.data[0].userId, buyerId);
  });

  test('13. Unauthenticated request to GET /api/notifications is rejected (401)', async () => {
    const res = await api('GET', '/api/notifications');
    assert.equal(res.status, 401);
  });

  test('14. PATCH /api/notifications/:id/read marks notification as read', async () => {
    const { farmerId, buyerId } = await makeParties('A14');
    __setTestOffer({
      offerId: `OFFER-READ-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Mustard',
      quantity: 90,
      offeredPrice: 50,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: `OFFER-READ-${TS}` }, await anyAuthHeaders());

    const list = await api('GET', '/api/notifications', null, await authHeaders(farmerId, 'farmer'));
    const notifId = list.json.data[0].id;
    assert.equal(list.json.data[0].read, false);

    const markRes = await api('PATCH', `/api/notifications/${notifId}/read`, null, await authHeaders(farmerId, 'farmer'));
    assert.equal(markRes.status, 200);
    assert.equal(markRes.json.data.read, true);
  });

  test('15. GET /api/deals/summary returns aggregated analytics', async () => {
    const { farmerId, buyerId } = await makeParties('A15');
    const party = await authHeaders(farmerId, 'farmer');
    __setTestOffer({
      offerId: `OFFER-SUM1-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Potato',
      quantity: 100,
      offeredPrice: 20,
      status: 'ACCEPTED',
    });

    const d = await api('POST', '/api/deals', { offerId: `OFFER-SUM1-${TS}` }, party);
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'CONFIRMED' }, party);
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'IN_PROGRESS' }, party);
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'COMPLETED' }, party);

    const res = await api('GET', `/api/deals/summary?farmerId=${farmerId}`, null, party);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.totalDeals, 1);
    assert.equal(res.json.data.completedDeals, 1);
    assert.equal(res.json.data.totalVolumeQuintals, 100);
    assert.equal(res.json.data.settledValueRupees, 2000);
  });
});
