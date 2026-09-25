// Unit tests: Zod validation schemas (no DB, no server, no network).
// Covers farmer / crop-listing / market-price query rules incl. error paths.
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/utils/validate');

describe('farmer validation', () => {
  test('accepts a valid create payload', () => {
    const r = v.farmerCreateSchema.safeParse({ name: 'Ravi Patil', phone: '+919812345678' });
    assert.equal(r.success, true);
  });

  test('rejects missing name / bad phone / bad email / bad coordinates', () => {
    assert.equal(v.farmerCreateSchema.safeParse({ phone: '+919812345678' }).success, false);
    assert.equal(v.farmerCreateSchema.safeParse({ name: 'Ravi', phone: 'bad' }).success, false);
    assert.equal(
      v.farmerCreateSchema.safeParse({ name: 'Ravi', phone: '+919812345678', email: 'nope' }).success,
      false
    );
    assert.equal(
      v.farmerCreateSchema.safeParse({ name: 'Ravi', phone: '+919812345678', latitude: 999 }).success,
      false
    );
    assert.equal(
      v.farmerCreateSchema.safeParse({ name: 'Ravi', phone: '+919812345678', longitude: -200 }).success,
      false
    );
  });

  test('normalizes empty email to undefined', () => {
    const r = v.farmerCreateSchema.safeParse({ name: 'Ravi', phone: '+919812345678', email: '' });
    assert.equal(r.success, true);
    assert.equal(r.data.email, undefined);
  });

  test('create rejects id / timestamps / trustScore / kycStatus', () => {
    const base = { name: 'Ravi', phone: '+919812345678' };
    for (const extra of [{ id: 'x' }, { createdAt: '2024-01-01' }, { updatedAt: '2024-01-01' }, { trustScore: 90 }, { kycStatus: 'VERIFIED' }]) {
      assert.equal(v.farmerCreateSchema.safeParse({ ...base, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  test('update allows kycStatus but still rejects trustScore / id', () => {
    assert.equal(v.farmerUpdateSchema.safeParse({ kycStatus: 'VERIFIED' }).success, true);
    assert.equal(v.farmerUpdateSchema.safeParse({ trustScore: 50 }).success, false);
    assert.equal(v.farmerUpdateSchema.safeParse({ id: 'x' }).success, false);
    assert.equal(v.farmerUpdateSchema.safeParse({}).success, true);
  });
});

describe('crop listing validation (price range)', () => {
  const base = { farmerId: 'f1', cropName: 'Onion', quantity: 1000, unit: 'kg' };

  test('accepts a valid range and min=max and 0/0', () => {
    assert.equal(
      v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: 24, maxExpectedPrice: 28 }).success,
      true
    );
    assert.equal(
      v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: 30, maxExpectedPrice: 30 }).success,
      true
    );
    assert.equal(
      v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: 0, maxExpectedPrice: 0 }).success,
      true
    );
  });

  test('rejects negatives, strings, min>max, missing bounds', () => {
    assert.equal(
      v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: -1, maxExpectedPrice: 5 }).success,
      false
    );
    assert.equal(
      v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: 1, maxExpectedPrice: -5 }).success,
      false
    );
    for (const s of ['cheap', 'high', 'unknown']) {
      assert.equal(
        v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: s, maxExpectedPrice: 5 }).success,
        false
      );
    }
    const bad = v.cropListingCreateSchema.safeParse({ ...base, minExpectedPrice: 28, maxExpectedPrice: 24 });
    assert.equal(bad.success, false);
    assert.match(JSON.stringify(bad.error.issues), /minExpectedPrice must be <= maxExpectedPrice/);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...base, maxExpectedPrice: 5 }).success, false);
  });

  test('rejects old expectedPrice, unknown pricing fields, id/timestamps', () => {
    const priced = { ...base, minExpectedPrice: 1, maxExpectedPrice: 2 };
    for (const extra of [{ expectedPrice: 5 }, { mandiPrice: 5 }, { buyerId: 'b' }, { id: 'x' }, { createdAt: '2024-01-01' }, { updatedAt: '2024-01-01' }]) {
      assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  test('update: single-bound patches pass zod; both-bounds-invalid fails', () => {
    assert.equal(v.cropListingUpdateSchema.safeParse({ minExpectedPrice: 26 }).success, true);
    assert.equal(
      v.cropListingUpdateSchema.safeParse({ minExpectedPrice: 31, maxExpectedPrice: 30 }).success,
      false
    );
  });

  test('rejects bad quantity / unit / status / coordinates / date', () => {
    const priced = { ...base, minExpectedPrice: 1, maxExpectedPrice: 2 };
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, quantity: 0 }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, quantity: -5 }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, unit: '  ' }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, status: 'SOLD' }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, latitude: 100 }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, availableFrom: 'garbage' }).success, false);
    assert.equal(v.cropListingCreateSchema.safeParse({ ...priced, status: 'MATCHED' }).success, true);
  });
});

describe('pagination validation', () => {
  test('defaults to page=1 limit=20, allows 100, rejects invalid', () => {
    assert.deepEqual(v.paginationQuerySchema.parse({}), { page: 1, limit: 20 });
    assert.equal(v.paginationQuerySchema.parse({ page: 2, limit: 100 }).limit, 100);
    for (const q of [{ page: 0 }, { limit: 0 }, { limit: 101 }, { page: 'x' }, { limit: 1.5 }]) {
      assert.equal(v.paginationQuerySchema.safeParse(q).success, false, JSON.stringify(q));
    }
  });
});

describe('market-price query validation', () => {
  test('accepts filters and defaults; treats empty strings as absent', () => {
    const r = v.marketPriceQuerySchema.safeParse({ commodity: 'Onion', state: '', page: '2' });
    assert.equal(r.success, true);
    assert.equal(r.data.page, 2);
    assert.equal(r.data.state, undefined);
  });

  test('rejects inverted date range and malformed dates', () => {
    assert.equal(
      v.marketPriceQuerySchema.safeParse({ dateFrom: '2024-02-05', dateTo: '2024-02-01' }).success,
      false
    );
    assert.equal(v.marketPriceQuerySchema.safeParse({ date: 'garbage' }).success, false);
    assert.equal(
      v.marketPriceQuerySchema.safeParse({ dateFrom: '2024-02-01', dateTo: '2024-02-05' }).success,
      true
    );
  });

  test('context requires commodity, defaults limit', () => {
    assert.equal(v.marketPriceContextSchema.safeParse({ state: 'MH' }).success, false);
    const r = v.marketPriceContextSchema.safeParse({ commodity: 'Onion' });
    assert.equal(r.success, true);
    assert.equal(r.data.limit, 20);
  });
});

describe('buyer validation', () => {
  test('accepts a valid create payload', () => {
    const r = v.buyerCreateSchema.safeParse({ name: 'Sahyadri Agro', phone: '+919812345678' });
    assert.equal(r.success, true);
  });

  test('rejects missing name / bad phone / bad email / bad coordinates', () => {
    assert.equal(v.buyerCreateSchema.safeParse({ phone: '+919812345678' }).success, false);
    assert.equal(v.buyerCreateSchema.safeParse({ name: 'Sahyadri', phone: 'invalid' }).success, false);
    assert.equal(
      v.buyerCreateSchema.safeParse({ name: 'Sahyadri', phone: '+919812345678', email: 'notanemail' }).success,
      false
    );
    assert.equal(
      v.buyerCreateSchema.safeParse({ name: 'Sahyadri', phone: '+919812345678', latitude: 95 }).success,
      false
    );
  });

  test('create rejects id / timestamps / unknown fields', () => {
    const base = { name: 'Sahyadri', phone: '+919812345678' };
    for (const extra of [{ id: 'x' }, { createdAt: '2024-01-01' }, { updatedAt: '2024-01-01' }, { trustScore: 90 }]) {
      assert.equal(v.buyerCreateSchema.safeParse({ ...base, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  test('update allows partial fields but rejects id / timestamps', () => {
    assert.equal(v.buyerUpdateSchema.safeParse({ companyName: 'Sahyadri Ltd' }).success, true);
    assert.equal(v.buyerUpdateSchema.safeParse({ id: 'x' }).success, false);
    assert.equal(v.buyerUpdateSchema.safeParse({}).success, true);
  });
});

describe('buyer requirement validation', () => {
  const base = { buyerId: 'b1', cropName: 'Onion', requiredQuantity: 500, unit: 'quintal', targetPrice: 1500 };

  test('accepts valid payload', () => {
    assert.equal(v.buyerRequirementCreateSchema.safeParse(base).success, true);
  });

  test('rejects missing required fields / invalid quantity / negative price', () => {
    assert.equal(v.buyerRequirementCreateSchema.safeParse({ ...base, buyerId: '' }).success, false);
    assert.equal(v.buyerRequirementCreateSchema.safeParse({ ...base, requiredQuantity: 0 }).success, false);
    assert.equal(v.buyerRequirementCreateSchema.safeParse({ ...base, requiredQuantity: -10 }).success, false);
    assert.equal(v.buyerRequirementCreateSchema.safeParse({ ...base, targetPrice: -1 }).success, false);
  });

  test('rejects id / timestamps / unknown fields', () => {
    for (const extra of [{ id: 'x' }, { createdAt: '2024-01-01' }, { updatedAt: '2024-01-01' }, { farmerId: 'f1' }]) {
      assert.equal(v.buyerRequirementCreateSchema.safeParse({ ...base, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  test('update allows partial fields', () => {
    assert.equal(v.buyerRequirementUpdateSchema.safeParse({ targetPrice: 1600 }).success, true);
    assert.equal(v.buyerRequirementUpdateSchema.safeParse({ id: 'x' }).success, false);
  });
});

