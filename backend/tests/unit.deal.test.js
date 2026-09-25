const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const dealService = require('../src/services/dealService');
const {
  __setTestOffer,
  __clearTestOffers,
} = require('../src/services/offerAdapter');
const {
  __clearTestNotifications,
  getUserNotifications,
} = require('../src/services/notificationService');

describe('B3 Deal Service Unit Tests', () => {
  beforeEach(() => {
    dealService.__clearTestDeals();
    __clearTestOffers();
    __clearTestNotifications();
  });

  test('1. Creates deal from accepted offer with server-side totalAmount calculation', async () => {
    __setTestOffer({
      offerId: 'O-101',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropId: 'C-301',
      cropName: 'Tomato Hybrid',
      quantity: 500,
      offeredPrice: 28,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({
      offerId: 'O-101',
      pickupLocation: 'Farm Gate, Dindori',
    });

    assert.ok(deal.id);
    assert.equal(deal.offerId, 'O-101');
    assert.equal(deal.farmerId, 'F-101');
    assert.equal(deal.buyerId, 'B-201');
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
    __setTestOffer({
      offerId: 'O-PENDING',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropName: 'Wheat',
      quantity: 100,
      offeredPrice: 22,
      status: 'PENDING',
    });

    await assert.rejects(
      async () => {
        await dealService.createDeal({ offerId: 'O-PENDING' });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /must be 'ACCEPTED'/);
        return true;
      }
    );
  });

  test('4. Prevents duplicate deals for the same accepted offer (409 Conflict)', async () => {
    __setTestOffer({
      offerId: 'O-DUP',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropName: 'Onion',
      quantity: 200,
      offeredPrice: 15,
      status: 'ACCEPTED',
    });

    const firstDeal = await dealService.createDeal({ offerId: 'O-DUP' });
    assert.ok(firstDeal.id);

    await assert.rejects(
      async () => {
        await dealService.createDeal({ offerId: 'O-DUP' });
      },
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /Deal already exists/);
        return true;
      }
    );
  });

  test('5. Accurately calculates total amount server-side including decimal prices', async () => {
    __setTestOffer({
      offerId: 'O-CALC',
      farmerId: 'F-102',
      buyerId: 'B-202',
      cropName: 'Soybean',
      quantity: 125.5,
      offeredPrice: 42.75,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: 'O-CALC' });
    // 125.5 * 42.75 = 5365.125 -> 5365.13
    assert.equal(deal.totalAmount, 5365.13);
  });

  test('6. Validates deal status lifecycle flow: ACCEPTED -> CONFIRMED -> IN_PROGRESS -> COMPLETED', async () => {
    __setTestOffer({
      offerId: 'O-FLOW',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropName: 'Potato',
      quantity: 300,
      offeredPrice: 18,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: 'O-FLOW' });
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
    __setTestOffer({
      offerId: 'O-JUMP',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropName: 'Potato',
      quantity: 300,
      offeredPrice: 18,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: 'O-JUMP' });

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
    __setTestOffer({
      offerId: 'O-CANCEL',
      farmerId: 'F-101',
      buyerId: 'B-201',
      cropName: 'Cotton',
      quantity: 50,
      offeredPrice: 65,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: 'O-CANCEL' });
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
    __setTestOffer({
      offerId: 'O-NOTIF',
      farmerId: 'F-NOTIF',
      buyerId: 'B-NOTIF',
      cropName: 'Mustard',
      quantity: 80,
      offeredPrice: 52,
      status: 'ACCEPTED',
    });

    const deal = await dealService.createDeal({ offerId: 'O-NOTIF' });

    const farmerNotifs = await getUserNotifications('F-NOTIF');
    const buyerNotifs = await getUserNotifications('B-NOTIF');

    assert.equal(farmerNotifs.data.length, 1);
    assert.equal(buyerNotifs.data.length, 1);
    assert.equal(farmerNotifs.data[0].dealId, deal.id);
    assert.equal(buyerNotifs.data[0].dealId, deal.id);
    assert.equal(buyerNotifs.data[0].type, 'DEAL_CREATED');
  });

  test('10. Calculates aggregated transaction summary stats', async () => {
    __setTestOffer({
      offerId: 'O-S1',
      farmerId: 'F-SUM',
      buyerId: 'B-SUM',
      cropName: 'Rice',
      quantity: 100,
      offeredPrice: 30,
      status: 'ACCEPTED',
    });
    __setTestOffer({
      offerId: 'O-S2',
      farmerId: 'F-SUM',
      buyerId: 'B-SUM',
      cropName: 'Wheat',
      quantity: 200,
      offeredPrice: 25,
      status: 'ACCEPTED',
    });

    const d1 = await dealService.createDeal({ offerId: 'O-S1' });
    const d2 = await dealService.createDeal({ offerId: 'O-S2' });

    // Complete d1
    await dealService.updateDealStatus(d1.id, 'CONFIRMED');
    await dealService.updateDealStatus(d1.id, 'IN_PROGRESS');
    await dealService.updateDealStatus(d1.id, 'COMPLETED');

    const summary = await dealService.getDealsSummary({ farmerId: 'F-SUM' });
    assert.equal(summary.totalDeals, 2);
    assert.equal(summary.completedDeals, 1);
    assert.equal(summary.activeDeals, 1);
    assert.equal(summary.totalVolumeQuintals, 300);
    // (100*30) + (200*25) = 3000 + 5000 = 8000
    assert.equal(summary.totalValueRupees, 8000);
    assert.equal(summary.settledValueRupees, 3000);
  });
});
