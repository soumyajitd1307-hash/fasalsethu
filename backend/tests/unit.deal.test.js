// The offer adapter's in-memory offer store is a test seam that is only
// reachable when NODE_ENV=test, so opt in before the adapter is used.
process.env.NODE_ENV = 'test';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const dealService = require('../src/services/dealService');
const farmerService = require('../src/services/farmerService');
const buyerService = require('../src/services/buyerService');
const {
  __setTestOffer,
  __clearTestOffers,
} = require('../src/services/offerAdapter');
const {
  getUserNotifications,
} = require('../src/services/notificationService');

// Deal persistence is PostgreSQL-only (no in-memory fallback), so these
// tests need a migrated database and use real persisted farmer/buyer IDs.
const HAVE_DB = !!process.env.DATABASE_URL;
const SKIP_DB = HAVE_DB ? false : 'BLOCKED: DATABASE_URL not set — needs local PostgreSQL';
const TS = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

const created = { farmers: [], buyers: [], userIds: [] };

async function makeParties(tag) {
  const phoneF = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const phoneB = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const farmer = await farmerService.createFarmer({
    name: `Deal Test Farmer ${tag}`,
    phone: phoneF,
    email: `deal-f-${tag}-${TS}@example.com`,
  });
  const buyer = await buyerService.createBuyer({
    name: `Deal Test Buyer ${tag}`,
    phone: phoneB,
    email: `deal-b-${tag}-${TS}@example.com`,
  });
  created.farmers.push(farmer.id);
  created.buyers.push(buyer.id);
  created.userIds.push(farmer.id, buyer.id);
  return { farmerId: farmer.id, buyerId: buyer.id };
}

describe('B3 Deal Service Unit Tests', { skip: SKIP_DB }, () => {
  before(async () => {
    // Fail loudly if DATABASE_URL is set but unreachable/unmigrated.
    const { getPrisma } = require('../src/config/database');
    await getPrisma().$queryRaw`SELECT 1`;
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
  });

  beforeEach(() => {
    __clearTestOffers();
  });

  test('1. Creates deal from accepted offer with server-side totalAmount calculation', async () => {
    const { farmerId, buyerId } = await makeParties('T1');
    __setTestOffer({
      offerId: `O-101-${TS}`,
      farmerId,
      buyerId,
      cropId: 'C-301',
      cropName: 'Tomato Hybrid',
      quantity: 500,
      offeredPrice: 28,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({
      offerId: `O-101-${TS}`,
      pickupLocation: 'Farm Gate, Dindori',
    });

    assert.ok(deal.id);
    assert.equal(deal.offerId, `O-101-${TS}`);
    assert.equal(deal.farmerId, farmerId);
    assert.equal(deal.buyerId, buyerId);
    assert.equal(deal.cropName, 'Tomato Hybrid');
    assert.equal(deal.quantity, 500);
    assert.equal(deal.agreedPrice, 28);
    // 500 * 28 = 14,000
    assert.equal(deal.totalAmount, 14000);
    assert.equal(deal.status, 'ACCEPTED');
    assert.equal(deal.pickupLocation, 'Farm Gate, Dindori');
  });

  test('2. Rejects deal creation if offer does not exist (404)', async () => {
    await assert.rejects(
      async () => {
        await dealService.createDeal({ offerId: 'NON_EXISTENT_OFFER' });
      },
      (err) => {
        assert.equal(err.status, 404);
        assert.match(err.message, /Offer not found/);
        return true;
      }
    );
  });

  test('3. Rejects deal creation if offer is not in ACCEPTED status (400)', async () => {
    const { farmerId, buyerId } = await makeParties('T3');
    __setTestOffer({
      offerId: `O-PENDING-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Wheat',
      quantity: 100,
      offeredPrice: 22,
      status: 'PENDING',
    });

    await assert.rejects(
      async () => {
        await dealService.createDeal({ offerId: `O-PENDING-${TS}` });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /must be 'ACCEPTED'/);
        return true;
      }
    );
  });

  test('4. Prevents duplicate deals for the same accepted offer (409 Conflict)', async () => {
    const { farmerId, buyerId } = await makeParties('T4');
    __setTestOffer({
      offerId: `O-DUP-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Onion',
      quantity: 200,
      offeredPrice: 15,
      status: 'ACCEPTED',
    });

    const firstDeal = await dealService.createDeal({ offerId: `O-DUP-${TS}` });
    assert.ok(firstDeal.id);

    await assert.rejects(
      async () => {
        await dealService.createDeal({ offerId: `O-DUP-${TS}` });
      },
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /Deal already exists/);
        return true;
      }
    );
  });

  test('5. Accurately calculates total amount server-side including decimal prices', async () => {
    const { farmerId, buyerId } = await makeParties('T5');
    __setTestOffer({
      offerId: `O-CALC-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Soybean',
      quantity: 125.5,
      offeredPrice: 42.75,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: `O-CALC-${TS}` });
    // 125.5 * 42.75 = 5365.125 -> 5365.13
    assert.equal(deal.totalAmount, 5365.13);
  });

  test('6. Validates deal status lifecycle flow: ACCEPTED -> CONFIRMED -> IN_PROGRESS -> COMPLETED', async () => {
    const { farmerId, buyerId } = await makeParties('T6');
    __setTestOffer({
      offerId: `O-FLOW-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Potato',
      quantity: 300,
      offeredPrice: 18,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: `O-FLOW-${TS}` });
    assert.equal(deal.status, 'ACCEPTED');

    // 1. CONFIRMED
    const confirmed = await dealService.updateDealStatus(deal.id, 'CONFIRMED');
    assert.equal(confirmed.status, 'CONFIRMED');

    // 2. IN_PROGRESS
    const inProgress = await dealService.updateDealStatus(deal.id, 'IN_PROGRESS');
    assert.equal(inProgress.status, 'IN_PROGRESS');

    // 3. COMPLETED
    const completed = await dealService.updateDealStatus(deal.id, 'COMPLETED');
    assert.equal(completed.status, 'COMPLETED');
    assert.ok(completed.completedAt);
  });

  test('7. Rejects nonsensical and skipped status transitions (400)', async () => {
    const { farmerId, buyerId } = await makeParties('T7');
    __setTestOffer({
      offerId: `O-JUMP-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Potato',
      quantity: 300,
      offeredPrice: 18,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: `O-JUMP-${TS}` });

    // Direct jump ACCEPTED -> COMPLETED is forbidden
    await assert.rejects(
      async () => {
        await dealService.updateDealStatus(deal.id, 'COMPLETED');
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Invalid status transition/);
        return true;
      }
    );

    // Advance to completed
    await dealService.updateDealStatus(deal.id, 'CONFIRMED');
    await dealService.updateDealStatus(deal.id, 'IN_PROGRESS');
    await dealService.updateDealStatus(deal.id, 'COMPLETED');

    // Backward transition COMPLETED -> IN_PROGRESS is forbidden
    await assert.rejects(
      async () => {
        await dealService.updateDealStatus(deal.id, 'IN_PROGRESS');
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /terminal status/);
        return true;
      }
    );
  });

  test('8. Allows safe cancellation and rejects modifying cancelled deals', async () => {
    const { farmerId, buyerId } = await makeParties('T8');
    __setTestOffer({
      offerId: `O-CANCEL-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Cotton',
      quantity: 50,
      offeredPrice: 65,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: `O-CANCEL-${TS}` });
    const cancelled = await dealService.cancelDeal(deal.id, 'Logistics unavailable');

    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.cancellationReason, 'Logistics unavailable');
    assert.ok(cancelled.cancelledAt);

    // Cancelled deals cannot be reactivated
    await assert.rejects(
      async () => {
        await dealService.updateDealStatus(deal.id, 'CONFIRMED');
      },
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('9. Triggers event notifications for both farmer and buyer upon deal creation', async () => {
    const { farmerId, buyerId } = await makeParties('T9');
    __setTestOffer({
      offerId: `O-NOTIF-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Mustard',
      quantity: 80,
      offeredPrice: 52,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: `O-NOTIF-${TS}` });

    const farmerNotifs = await getUserNotifications(farmerId);
    const buyerNotifs = await getUserNotifications(buyerId);

    assert.equal(farmerNotifs.data.length, 1);
    assert.equal(buyerNotifs.data.length, 1);
    assert.equal(farmerNotifs.data[0].dealId, deal.id);
    assert.equal(buyerNotifs.data[0].dealId, deal.id);
    assert.equal(buyerNotifs.data[0].type, 'DEAL_CREATED');
  });

  test('10. Calculates aggregated transaction summary stats', async () => {
    const { farmerId, buyerId } = await makeParties('T10');
    __setTestOffer({
      offerId: `O-S1-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Rice',
      quantity: 100,
      offeredPrice: 30,
      status: 'ACCEPTED',
    });
    __setTestOffer({
      offerId: `O-S2-${TS}`,
      farmerId,
      buyerId,
      cropName: 'Wheat',
      quantity: 200,
      offeredPrice: 25,
      status: 'ACCEPTED',
    });

    const d1 = await dealService.createDeal({ offerId: `O-S1-${TS}` });
    const d2 = await dealService.createDeal({ offerId: `O-S2-${TS}` });

    // Complete d1
    await dealService.updateDealStatus(d1.id, 'CONFIRMED');
    await dealService.updateDealStatus(d1.id, 'IN_PROGRESS');
    await dealService.updateDealStatus(d1.id, 'COMPLETED');

    const summary = await dealService.getDealsSummary({ farmerId });
    assert.equal(summary.totalDeals, 2);
    assert.equal(summary.completedDeals, 1);
    assert.equal(summary.activeDeals, 1);
    assert.equal(summary.totalVolumeQuintals, 300);
    // (100*30) + (200*25) = 3000 + 5000 = 8000
    assert.equal(summary.totalValueRupees, 8000);
    assert.equal(summary.settledValueRupees, 3000);
  });
});
