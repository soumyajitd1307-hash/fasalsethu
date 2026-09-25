// Unit tests: Price Discovery logic (midpoint, unit conversion, price diffs, mismatch handling).
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateMidPrice,
  comparePriceWithUnits,
} = require('../src/services/priceDiscoveryService');

describe('Price Discovery Unit Tests', () => {
  test('1. Farmer price midpoint calculation', () => {
    assert.equal(calculateMidPrice(24, 28), 26);
    assert.equal(calculateMidPrice(100, 100), 100);
    assert.equal(calculateMidPrice(0, 50), 25);
    assert.equal(calculateMidPrice(24.5, 27.5), 26);
  });

  test('2. Buyer target price comparison (same unit)', () => {
    const res = comparePriceWithUnits(2800, 'quintal', 2600, 'quintal');
    assert.equal(res.unitMatch, true);
    assert.equal(res.priceDifference, 200);
    assert.equal(res.priceDifferencePercent, 7.69);
  });

  test('3. Percentage difference calculation', () => {
    const lower = comparePriceWithUnits(2470, 'quintal', 2600, 'quintal');
    assert.equal(lower.priceDifference, -130);
    assert.equal(lower.priceDifferencePercent, -5);

    const equal = comparePriceWithUnits(2600, 'quintal', 2600, 'quintal');
    assert.equal(equal.priceDifference, 0);
    assert.equal(equal.priceDifferencePercent, 0);
  });

  test('4. Market price comparison with unit conversion (kg <-> quintal)', () => {
    // 27 Rs/kg = 2700 Rs/quintal vs midPrice 2600 Rs/quintal
    const converted = comparePriceWithUnits(27, 'kg', 2600, 'quintal');
    assert.equal(converted.unitMatch, true);
    assert.equal(converted.priceDifference, 100);
    assert.equal(converted.priceDifferencePercent, 3.85);
  });

  test('5 & 6. No market data / empty buyer requirements fallback format', () => {
    const nullRes = comparePriceWithUnits(null, 'quintal', 2600, 'quintal');
    assert.equal(nullRes.unitMatch, false);
    assert.equal(nullRes.priceDifference, null);
    assert.equal(nullRes.priceDifferencePercent, null);
  });

  test('8. Unit mismatch handling (incompatible unit)', () => {
    const badUnit = comparePriceWithUnits(50, 'crate', 2600, 'quintal');
    assert.equal(badUnit.unitMatch, false);
    assert.equal(badUnit.priceDifference, null);
    assert.equal(badUnit.priceDifferencePercent, null);
  });
});
