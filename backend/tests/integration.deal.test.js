const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../src/app');
const dealService = require('../src/services/dealService');
const { __setTestOffer, __clearTestOffers } = require('../src/services/offerAdapter');
const { __clearTestNotifications } = require('../src/services/notificationService');

describe('B3 Deal & Notification API Integration Tests', () => {
  let server;
  let baseUrl;

  before((_, done) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((_, done) => {
    if (server) server.close(done);
    else done();
  });

  beforeEach(() => {
    dealService.__clearTestDeals();
    __clearTestOffers();
    __clearTestNotifications();
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

  test('1. POST /api/deals creates a deal from an accepted offer and calculates totalAmount', async () => {
    __setTestOffer({
      offerId: 'OFFER-001',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Nashik Red Onion',
      quantity: 500,
      offeredPrice: 28,
      status: 'ACCEPTED',
    });

    const res = await api('POST', '/api/deals', {
      offerId: 'OFFER-001',
      pickupLocation: 'Lasalgaon Mandi Yard',
      deliveryLocation: 'Vashi Warehouse Hub',
    });

    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.offerId, 'OFFER-001');
    assert.equal(res.json.data.farmerId, 'FARMER-1');
    assert.equal(res.json.data.buyerId, 'BUYER-1');
    assert.equal(res.json.data.quantity, 500);
    assert.equal(res.json.data.agreedPrice, 28);
    // 500 * 28 = 14000
    assert.equal(res.json.data.totalAmount, 14000);
    assert.equal(res.json.data.status, 'ACCEPTED');
  });

  test('2. POST /api/deals rejects if offer does not exist (404)', async () => {
    const res = await api('POST', '/api/deals', { offerId: 'GHOST-OFFER' });
    assert.equal(res.status, 404);
    assert.match(res.json.message, /Offer not found/);
  });

  test('3. POST /api/deals rejects if offer is not accepted (400)', async () => {
    __setTestOffer({
      offerId: 'OFFER-REJECTED',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Wheat',
      quantity: 100,
      offeredPrice: 20,
      status: 'REJECTED',
    });

    const res = await api('POST', '/api/deals', { offerId: 'OFFER-REJECTED' });
    assert.equal(res.status, 400);
    assert.match(res.json.message, /must be 'ACCEPTED'/);
  });

  test('4. POST /api/deals duplicate deal protection rejects second creation attempt (409 Conflict)', async () => {
    __setTestOffer({
      offerId: 'OFFER-DUP',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Potato',
      quantity: 250,
      offeredPrice: 16,
      status: 'ACCEPTED',
    });

    const first = await api('POST', '/api/deals', { offerId: 'OFFER-DUP' });
    assert.equal(first.status, 201);

    const second = await api('POST', '/api/deals', { offerId: 'OFFER-DUP' });
    assert.equal(second.status, 409);
    assert.match(second.json.message, /Deal already exists/);
  });

  test('5. GET /api/deals/:id retrieves single deal details', async () => {
    __setTestOffer({
      offerId: 'OFFER-GET',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Soybean',
      quantity: 50,
      offeredPrice: 48,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: 'OFFER-GET' });
    const dealId = created.json.data.id;

    const res = await api('GET', `/api/deals/${dealId}`);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.id, dealId);
    assert.equal(res.json.data.cropName, 'Soybean');
  });

  test('6. PATCH /api/deals/:id/status lifecycle: CONFIRMED -> IN_PROGRESS -> COMPLETED', async () => {
    __setTestOffer({
      offerId: 'OFFER-STATUS',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Cotton',
      quantity: 80,
      offeredPrice: 70,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: 'OFFER-STATUS' });
    const dealId = created.json.data.id;

    // 1. CONFIRMED
    const r1 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'CONFIRMED' });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.data.status, 'CONFIRMED');

    // 2. IN_PROGRESS
    const r2 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'IN_PROGRESS' });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.data.status, 'IN_PROGRESS');

    // 3. COMPLETED
    const r3 = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'COMPLETED' });
    assert.equal(r3.status, 200);
    assert.equal(r3.json.data.status, 'COMPLETED');
    assert.ok(r3.json.data.completedAt);
  });

  test('7. PATCH /api/deals/:id/status rejects invalid transitions (400)', async () => {
    __setTestOffer({
      offerId: 'OFFER-INVALID',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Tomato',
      quantity: 100,
      offeredPrice: 20,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: 'OFFER-INVALID' });
    const dealId = created.json.data.id;

    // Direct jump ACCEPTED -> COMPLETED is forbidden
    const bad = await api('PATCH', `/api/deals/${dealId}/status`, { status: 'COMPLETED' });
    assert.equal(bad.status, 400);
    assert.match(bad.json.message, /Invalid status transition/);
  });

  test('8. PATCH /api/deals/:id/cancel cancels deal and records reason', async () => {
    __setTestOffer({
      offerId: 'OFFER-CANCEL',
      farmerId: 'FARMER-1',
      buyerId: 'BUYER-1',
      cropName: 'Maize',
      quantity: 120,
      offeredPrice: 19,
      status: 'ACCEPTED',
    });

    const created = await api('POST', '/api/deals', { offerId: 'OFFER-CANCEL' });
    const dealId = created.json.data.id;

    const res = await api('PATCH', `/api/deals/${dealId}/cancel`, {
      reason: 'Adverse weather damaged farm produce',
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, 'CANCELLED');
    assert.equal(res.json.data.cancellationReason, 'Adverse weather damaged farm produce');
  });

  test('9. Farmer can retrieve own deals: GET /api/deals/farmer/:farmerId', async () => {
    __setTestOffer({
      offerId: 'OFFER-FARMER',
      farmerId: 'FARMER-A',
      buyerId: 'BUYER-A',
      cropName: 'Rice',
      quantity: 200,
      offeredPrice: 32,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: 'OFFER-FARMER' });

    const res = await api('GET', '/api/deals/farmer/FARMER-A', null, {
      'x-user-id': 'FARMER-A',
      'x-user-role': 'farmer',
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 1);
    assert.equal(res.json.data[0].farmerId, 'FARMER-A');
  });

  test('10. Buyer can retrieve own deals: GET /api/deals/buyer/:buyerId', async () => {
    __setTestOffer({
      offerId: 'OFFER-BUYER',
      farmerId: 'FARMER-B',
      buyerId: 'BUYER-B',
      cropName: 'Wheat',
      quantity: 400,
      offeredPrice: 24,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: 'OFFER-BUYER' });

    const res = await api('GET', '/api/deals/buyer/BUYER-B', null, {
      'x-user-id': 'BUYER-B',
      'x-user-role': 'buyer',
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 1);
    assert.equal(res.json.data[0].buyerId, 'BUYER-B');
  });

  test('11. Unauthorized access to another user deals is rejected (403 Forbidden)', async () => {
    // Impostor farmer trying to spy on FARMER-SECRET deals
    const res = await api('GET', '/api/deals/farmer/FARMER-SECRET', null, {
      'x-user-id': 'IMPOSTOR-FARMER',
      'x-user-role': 'farmer',
    });
    assert.equal(res.status, 403);
    assert.match(res.json.message, /Access denied/);
  });

  test('12. Deal creation automatically creates notifications for both parties', async () => {
    __setTestOffer({
      offerId: 'OFFER-NOTIFS',
      farmerId: 'FARMER-N',
      buyerId: 'BUYER-N',
      cropName: 'Sunflower',
      quantity: 60,
      offeredPrice: 55,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: 'OFFER-NOTIFS' });

    const farmerNotifs = await api('GET', '/api/notifications', null, {
      'x-user-id': 'FARMER-N',
    });
    assert.equal(farmerNotifs.status, 200);
    assert.equal(farmerNotifs.json.data.length, 1);
    assert.equal(farmerNotifs.json.data[0].userId, 'FARMER-N');

    const buyerNotifs = await api('GET', '/api/notifications', null, {
      'x-user-id': 'BUYER-N',
    });
    assert.equal(buyerNotifs.status, 200);
    assert.equal(buyerNotifs.json.data.length, 1);
    assert.equal(buyerNotifs.json.data[0].userId, 'BUYER-N');
  });

  test('13. Unauthenticated request to GET /api/notifications is rejected (401)', async () => {
    const res = await api('GET', '/api/notifications');
    assert.equal(res.status, 401);
  });

  test('14. PATCH /api/notifications/:id/read marks notification as read', async () => {
    __setTestOffer({
      offerId: 'OFFER-READ',
      farmerId: 'FARMER-R',
      buyerId: 'BUYER-R',
      cropName: 'Mustard',
      quantity: 90,
      offeredPrice: 50,
      status: 'ACCEPTED',
    });

    await api('POST', '/api/deals', { offerId: 'OFFER-READ' });

    const list = await api('GET', '/api/notifications', null, {
      'x-user-id': 'FARMER-R',
    });
    const notifId = list.json.data[0].id;
    assert.equal(list.json.data[0].read, false);

    const markRes = await api('PATCH', `/api/notifications/${notifId}/read`, null, {
      'x-user-id': 'FARMER-R',
    });
    assert.equal(markRes.status, 200);
    assert.equal(markRes.json.data.read, true);
  });

  test('15. GET /api/deals/summary returns aggregated analytics', async () => {
    __setTestOffer({
      offerId: 'OFFER-SUM1',
      farmerId: 'FARMER-SUM',
      buyerId: 'BUYER-SUM',
      cropName: 'Potato',
      quantity: 100,
      offeredPrice: 20,
      status: 'ACCEPTED',
    });

    const d = await api('POST', '/api/deals', { offerId: 'OFFER-SUM1' });
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'CONFIRMED' });
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'IN_PROGRESS' });
    await api('PATCH', `/api/deals/${d.json.data.id}/status`, { status: 'COMPLETED' });

    const res = await api('GET', '/api/deals/summary?farmerId=FARMER-SUM');
    assert.equal(res.status, 200);
    assert.equal(res.json.data.totalDeals, 1);
    assert.equal(res.json.data.completedDeals, 1);
    assert.equal(res.json.data.totalVolumeQuintals, 100);
    assert.equal(res.json.data.settledValueRupees, 2000);
  });
});
