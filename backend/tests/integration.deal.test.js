// The offer adapter's in-memory offer store is a test seam that is only
// reachable when NODE_ENV=test, so opt in before the adapter is used.
process.env.NODE_ENV = 'test';

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createHarness } = require('./helpers/jwt-test-server');
const {
  __setTestOffer,
  __clearTestOffers,
  __resetOfferProvider,
  registerOfferProvider,
} = require('../src/services/offerAdapter');

// Deal persistence is PostgreSQL-only (no in-memory fallback), so these
// tests need a migrated database and use real persisted farmer/buyer IDs.
// Requests carry real RS256 Bearer tokens minted against a local test JWKS;
// plain x-user-id headers alone are (correctly) rejected with 401.
// Load backend/.env (if present) so DB availability never depends on the order
// in which this file requires modules. dotenv is idempotent and never overrides
// real environment variables; loading it here deliberately does NOT instantiate
// the cached config module, because the Auth0 test env is applied in `before`.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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

  // Creates a persisted deal between two fresh parties, for authorization tests.
  async function seedDeal(tag, { quantity = 100, price = 20, cropName = 'Rice' } = {}) {
    const { farmerId, buyerId } = await makeParties(tag);
    const offerId = `OFFER-${tag}-${TS}`;
    __setTestOffer({
      offerId,
      farmerId,
      buyerId,
      cropName,
      quantity,
      offeredPrice: price,
      status: 'ACCEPTED',
    });
    const res = await api('POST', '/api/deals', { offerId }, await anyAuthHeaders());
    assert.equal(res.status, 201, `seed deal ${tag} must be created`);
    return { farmerId, buyerId, offerId, dealId: res.json.data.id };
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

  // The production Deal -> Offer dependency: a registered offer provider is the
  // only source of accepted offers outside tests, and deal creation must work
  // through it without any in-memory offer record.
  describe('offer provider (production path)', () => {
    const providerOffers = new Map();

    beforeEach(() => {
      providerOffers.clear();
      registerOfferProvider({
        getOfferById: async (id) => providerOffers.get(id) || null,
      });
    });

    afterEach(() => {
      // Restore the environment first: a test may have switched it to
      // 'production' to assert that the test offer store is unreachable.
      process.env.NODE_ENV = 'test';
      __resetOfferProvider();
    });

    test('16. POST /api/deals creates a persisted deal from a registered provider', async () => {
      const { farmerId, buyerId } = await makeParties('P1');
      const offerId = `PROVIDER-ACCEPTED-${TS}`;
      providerOffers.set(offerId, {
        offerId,
        farmerId,
        buyerId,
        cropName: 'Soybean',
        quantity: 40,
        unit: 'quintal',
        offeredPrice: 45,
        status: 'ACCEPTED',
      });

      const res = await api('POST', '/api/deals', { offerId }, await anyAuthHeaders());

      assert.equal(res.status, 201);
      assert.equal(res.json.data.offerId, offerId);
      assert.equal(res.json.data.farmerId, farmerId);
      assert.equal(res.json.data.buyerId, buyerId);
      assert.equal(res.json.data.cropName, 'Soybean');
      assert.equal(res.json.data.agreedPrice, 45);
      assert.equal(res.json.data.totalAmount, 1800);

      // The deal really is in PostgreSQL, not an in-memory fake.
      const { getPrisma } = require('../src/config/database');
      const stored = await getPrisma().deal.findUnique({ where: { offerId } });
      assert.ok(stored, 'deal row must exist in PostgreSQL');
      assert.equal(stored.status, 'ACCEPTED');
    });

    test('17. POST /api/deals rejects a provider offer that is not ACCEPTED', async () => {
      const { farmerId, buyerId } = await makeParties('P2');
      const offerId = `PROVIDER-PENDING-${TS}`;
      providerOffers.set(offerId, {
        offerId,
        farmerId,
        buyerId,
        quantity: 10,
        offeredPrice: 20,
        status: 'NEGOTIATING',
      });

      const res = await api('POST', '/api/deals', { offerId }, await anyAuthHeaders());

      assert.equal(res.status, 400);
      assert.match(res.json.message, /must be 'ACCEPTED'/);
    });

    test('18. POST /api/deals returns 404 when the provider has no such offer', async () => {
      const res = await api(
        'POST',
        '/api/deals',
        { offerId: `PROVIDER-ABSENT-${TS}` },
        await anyAuthHeaders()
      );

      assert.equal(res.status, 404);
      assert.match(res.json.message, /Offer not found/);
    });

    test('19. in production, an unconfigured offer provider fails closed with 503 and stores nothing', async () => {
      const offerId = `PROVIDER-UNCONFIGURED-${TS}`;
      __resetOfferProvider();
      process.env.NODE_ENV = 'production';

      // Even a well-formed offer cannot be smuggled in: the test store is
      // unreachable in production.
      assert.throws(
        () =>
          __setTestOffer({
            offerId,
            farmerId: 'F-SMUGGLE',
            buyerId: 'B-SMUGGLE',
            quantity: 1,
            offeredPrice: 1,
            status: 'ACCEPTED',
          }),
        /test-only helper/
      );

      const res = await api('POST', '/api/deals', { offerId }, await anyAuthHeaders());

      assert.equal(res.status, 503);
      assert.match(res.json.message, /No offer provider is registered/);

      const { getPrisma } = require('../src/config/database');
      const stored = await getPrisma().deal.findUnique({ where: { offerId } });
      assert.equal(stored, null, 'no deal row may be created without a real offer');
    });
  });

  // Collection-level authorization: identity comes only from the verified JWT
  // `sub`, and an authenticated user must never read another user's deal list,
  // deal aggregates, or notifications.
  describe('collection authorization (owner scoping)', () => {
    test('20. GET /api/deals returns only the calling farmer\'s own deals', async () => {
      const mine = await seedDeal('C20A');
      const other = await seedDeal('C20B');

      const res = await api('GET', '/api/deals?limit=100', null, await authHeaders(mine.farmerId, 'farmer'));

      assert.equal(res.status, 200);
      const ids = res.json.data.map((d) => d.id);
      assert.ok(ids.includes(mine.dealId), 'own deal must be listed');
      assert.ok(!ids.includes(other.dealId), "another farmer's deal must not be listed");
      for (const deal of res.json.data) {
        assert.equal(deal.farmerId, mine.farmerId, 'no row from another farmer may appear');
      }
      assert.equal(res.json.pagination.total, 1, 'count must not include other farmers');
    });

    test('21. GET /api/deals returns only the calling buyer\'s own deals', async () => {
      const mine = await seedDeal('C21A');
      const other = await seedDeal('C21B');

      const res = await api('GET', '/api/deals?limit=100', null, await authHeaders(mine.buyerId, 'buyer'));

      assert.equal(res.status, 200);
      const ids = res.json.data.map((d) => d.id);
      assert.ok(ids.includes(mine.dealId), 'own deal must be listed');
      assert.ok(!ids.includes(other.dealId), "another buyer's deal must not be listed");
      for (const deal of res.json.data) {
        assert.equal(deal.buyerId, mine.buyerId, 'no row from another buyer may appear');
      }
      assert.equal(res.json.pagination.total, 1, 'count must not include other buyers');
    });

    test('22. a farmer cannot filter the deal list by another farmerId -> 403', async () => {
      const mine = await seedDeal('C22A');
      const other = await seedDeal('C22B');

      const res = await api(
        'GET',
        `/api/deals?farmerId=${other.farmerId}`,
        null,
        await authHeaders(mine.farmerId, 'farmer')
      );

      assert.equal(res.status, 403);
      assert.match(res.json.message, /Access denied/);
      assert.equal(res.json.data, undefined, 'no deal data may be disclosed');
    });

    test('23. a buyer cannot filter the deal list by another buyerId -> 403', async () => {
      const mine = await seedDeal('C23A');
      const other = await seedDeal('C23B');

      const otherBuyer = await api(
        'GET',
        `/api/deals?buyerId=${other.buyerId}`,
        null,
        await authHeaders(mine.buyerId, 'buyer')
      );
      assert.equal(otherBuyer.status, 403);
      assert.match(otherBuyer.json.message, /Access denied/);

      // A farmer is not a buyer at all, so the buyerId filter is never theirs
      // to use — not even pointing at their own id.
      const farmerUsingBuyerFilter = await api(
        'GET',
        `/api/deals?buyerId=${mine.farmerId}`,
        null,
        await authHeaders(mine.farmerId, 'farmer')
      );
      assert.equal(farmerUsingBuyerFilter.status, 403);
      assert.match(farmerUsingBuyerFilter.json.message, /Access denied/);
    });

    test('24. GET /api/deals/summary for another participant -> 403', async () => {
      const mine = await seedDeal('C24A');
      const other = await seedDeal('C24B');

      const res = await api(
        'GET',
        `/api/deals/summary?farmerId=${other.farmerId}`,
        null,
        await authHeaders(mine.farmerId, 'farmer')
      );

      assert.equal(res.status, 403);
      assert.match(res.json.message, /Access denied/);
      assert.equal(res.json.data, undefined, "no aggregate may be disclosed for another farmer");
    });

    test('25. GET /api/deals/summary with no filter aggregates only the caller\'s deals', async () => {
      const mine = await seedDeal('C25A');
      await seedDeal('C25B');

      const own = await api('GET', '/api/deals/summary', null, await authHeaders(mine.farmerId, 'farmer'));
      assert.equal(own.status, 200);
      assert.equal(own.json.data.totalDeals, 1, 'summary must not aggregate the whole platform');

      const ownBuyer = await api('GET', '/api/deals/summary', null, await authHeaders(mine.buyerId, 'buyer'));
      assert.equal(ownBuyer.status, 200);
      assert.equal(ownBuyer.json.data.totalDeals, 1);

      // Sanity check that an unscoped read really would have been larger: the
      // documented privileged role still sees every deal.
      const privileged = await api('GET', '/api/deals/summary', null, await authHeaders('admin-tester', 'admin'));
      assert.equal(privileged.status, 200);
      assert.ok(privileged.json.data.totalDeals > 1, 'admin summary spans all deals');
    });

    test('26. cross-role history reads are denied in both directions', async () => {
      const target = await seedDeal('C26');

      const buyerReadingFarmer = await api(
        'GET',
        `/api/deals/farmer/${target.farmerId}`,
        null,
        await authHeaders('unrelated-buyer', 'buyer')
      );
      assert.equal(buyerReadingFarmer.status, 403);
      assert.match(buyerReadingFarmer.json.message, /Access denied/);

      const farmerReadingBuyer = await api(
        'GET',
        `/api/deals/buyer/${target.buyerId}`,
        null,
        await authHeaders('unrelated-farmer', 'farmer')
      );
      assert.equal(farmerReadingBuyer.status, 403);
      assert.match(farmerReadingBuyer.json.message, /Access denied/);
    });

    test('27. notification list and unread count expose only the caller\'s rows', async () => {
      const mine = await seedDeal('C27A');
      const other = await seedDeal('C27B');

      const list = await api('GET', '/api/notifications?limit=100', null, await authHeaders(mine.farmerId, 'farmer'));
      assert.equal(list.status, 200);
      assert.ok(list.json.data.length >= 1);
      for (const n of list.json.data) {
        assert.equal(n.userId, mine.farmerId, 'no other user\'s notification may be listed');
      }

      const otherList = await api('GET', '/api/notifications', null, await authHeaders(other.farmerId, 'farmer'));
      const otherIds = otherList.json.data.map((n) => n.id);
      const myIds = list.json.data.map((n) => n.id);
      for (const id of otherIds) {
        assert.ok(!myIds.includes(id), "another farmer's notification id must not be reachable");
      }

      const unread = await api('GET', '/api/notifications/unread', null, await authHeaders(mine.farmerId, 'farmer'));
      assert.equal(unread.status, 200);
      assert.equal(unread.json.unreadCount, 1, 'unread count must be per-user, not platform-wide');
      for (const n of unread.json.data) {
        assert.equal(n.userId, mine.farmerId);
      }
    });

    test('28. a user cannot mark another user\'s notification as read -> 403', async () => {
      const other = await seedDeal('C28');
      const otherList = await api('GET', '/api/notifications', null, await authHeaders(other.farmerId, 'farmer'));
      const notifId = otherList.json.data[0].id;

      const res = await api(
        'PATCH',
        `/api/notifications/${notifId}/read`,
        null,
        await authHeaders('unrelated-farmer', 'farmer')
      );
      assert.equal(res.status, 403);
      assert.match(res.json.message, /cannot modify another user/);

      const recheck = await api('GET', '/api/notifications', null, await authHeaders(other.farmerId, 'farmer'));
      const row = recheck.json.data.find((n) => n.id === notifId);
      assert.equal(row.read, false, 'the notification must remain unread');
    });

    test('29. a token that is neither farmer nor buyer cannot read deal collections -> 403', async () => {
      const token = await authHeaders('plain-user', 'user');

      const list = await api('GET', '/api/deals', null, token);
      assert.equal(list.status, 403);
      assert.match(list.json.message, /Access denied/);

      const summary = await api('GET', '/api/deals/summary', null, token);
      assert.equal(summary.status, 403);
      assert.match(summary.json.message, /Access denied/);
    });

    test('30. admin keeps documented cross-participant read access', async () => {
      const mine = await seedDeal('C30A');
      const other = await seedDeal('C30B');

      const all = await api('GET', '/api/deals?limit=100', null, await authHeaders('admin-tester', 'admin'));
      assert.equal(all.status, 200);
      const ids = all.json.data.map((d) => d.id);
      assert.ok(ids.includes(mine.dealId), 'admin sees the first deal');
      assert.ok(ids.includes(other.dealId), 'admin sees the second deal');

      const narrowed = await api(
        'GET',
        `/api/deals?farmerId=${other.farmerId}&limit=100`,
        null,
        await authHeaders('admin-tester', 'admin')
      );
      assert.equal(narrowed.status, 200);
      for (const d of narrowed.json.data) {
        assert.equal(d.farmerId, other.farmerId, 'admin may still narrow with an explicit filter');
      }
    });
  });
});
