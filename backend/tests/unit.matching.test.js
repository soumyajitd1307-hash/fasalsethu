// Unit tests: Matching Engine (crop, quantity, price, distance, trust, sorting).
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  haversineDistanceKm,
  convertQuantity,
  calculateMatchScore,
} = require('../src/services/matchingService');

describe('Matching Engine Unit Tests', () => {
  const listing = {
    id: 'crop-1',
    cropName: 'Onion (Nashik Red)',
    quantity: 100,
    unit: 'quintal',
    minExpectedPrice: 2400,
    maxExpectedPrice: 2800,
    latitude: 20.201,
    longitude: 73.832,
  };

  test('1 & 2. Same crop matching & factor scoring', () => {
    const req = {
      id: 'req-1',
      buyerId: 'b1',
      cropName: 'Onion',
      requiredQuantity: 200,
      unit: 'quintal',
      targetPrice: 2600,
      latitude: 20.05,
      longitude: 73.78,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.crop, 25);
    assert.ok(res.matchReasons.includes('Crop matches'));
  });

  test('3. Full quantity compatibility (req >= listing)', () => {
    const req = {
      requiredQuantity: 100,
      unit: 'quintal',
      targetPrice: 2600,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.quantity, 20);
    assert.ok(res.matchReasons.some((r) => r.includes('full listing quantity')));
  });

  test('4. Partial quantity compatibility (req < listing)', () => {
    const req = {
      requiredQuantity: 50,
      unit: 'quintal',
      targetPrice: 2600,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.quantity, 10);
    assert.ok(res.matchReasons.some((r) => r.includes('partial listing quantity')));
  });

  test('5. Compatible unit conversion (kg vs quintal)', () => {
    const converted = convertQuantity(10000, 'kg', 'quintal');
    assert.equal(converted, 100);

    const req = {
      requiredQuantity: 10000,
      unit: 'kg',
      targetPrice: 26,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.quantity, 20);
    assert.equal(res.score.price, 25);
    assert.equal(res.unitMatch, true);
  });

  test('6. Unit mismatch (no misleading price comparisons)', () => {
    const converted = convertQuantity(100, 'crate', 'quintal');
    assert.equal(converted, null);

    const req = {
      requiredQuantity: 100,
      unit: 'crate',
      targetPrice: 500,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.unitMatch, false);
    assert.equal(res.score.quantity, 0);
    assert.equal(res.score.price, 0);
    assert.equal(res.priceComparison.difference, null);
    assert.equal(res.priceComparison.differencePercent, null);
  });

  test('7. Price inside farmer range → 25', () => {
    const req = {
      requiredQuantity: 100,
      unit: 'quintal',
      targetPrice: 2500,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.price, 25);
    assert.ok(res.matchReasons.includes('Buyer target price is within farmer expected price range'));
  });

  test('7b. Price above max farmer range → 25', () => {
    const req = {
      requiredQuantity: 100,
      unit: 'quintal',
      targetPrice: 3000,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.price, 25);
    assert.ok(res.matchReasons.includes('Buyer target price is above farmer expected price range'));
  });

  test('8. Price outside farmer range (below min) → proportional score', () => {
    const req = {
      requiredQuantity: 100,
      unit: 'quintal',
      targetPrice: 1200,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.price, 12.5);
  });

  test('8b. minExpectedPrice = 0 does not cause NaN or Infinity', () => {
    const zeroListing = { ...listing, minExpectedPrice: 0, maxExpectedPrice: 100 };
    const req = { requiredQuantity: 100, unit: 'quintal', targetPrice: 50 };
    const res = calculateMatchScore(zeroListing, req);
    assert.equal(res.score.price, 25);
    assert.ok(!Number.isNaN(res.score.total));
    assert.ok(Number.isFinite(res.score.total));
  });

  test('9. Haversine distance calculation', () => {
    const dist = haversineDistanceKm(20.201, 73.832, 20.05, 73.78);
    assert.equal(dist, 17.6);
  });

  test('10. Distance scoring bands', () => {
    const req10 = { requiredQuantity: 100, unit: 'quintal', targetPrice: 2600, latitude: 20.201, longitude: 73.832 };
    assert.equal(calculateMatchScore(listing, req10).score.distance, 15);

    const req25 = { requiredQuantity: 100, unit: 'quintal', targetPrice: 2600, latitude: 20.05, longitude: 73.78 };
    assert.equal(calculateMatchScore(listing, req25).score.distance, 12);
  });

  test('11. Missing coordinates', () => {
    const req = { requiredQuantity: 100, unit: 'quintal', targetPrice: 2600, latitude: null, longitude: null };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.distanceKm, null);
    assert.equal(res.score.distance, 0);
  });

  test('12. Neutral trust score is explicitly marked unavailable (trustScoreAvailable: false)', () => {
    const req = { requiredQuantity: 100, unit: 'quintal', targetPrice: 2600 };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.trustScoreAvailable, false);
    assert.equal(res.score.trust, 7.5);
    assert.ok(!res.matchReasons.some((r) => /trust/i.test(r)));
  });

  test('13. Total score calculation', () => {
    const req = {
      requiredQuantity: 100,
      unit: 'quintal',
      targetPrice: 2600,
      latitude: 20.201,
      longitude: 73.832,
    };
    const res = calculateMatchScore(listing, req);
    assert.equal(res.score.total, 92.5);
  });
});
