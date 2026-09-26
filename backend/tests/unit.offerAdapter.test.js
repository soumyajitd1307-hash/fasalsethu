// Offer adapter contract tests (no database required).
//
// These lock in the production-safety rules of the B3 offer boundary:
//   - a registered provider is the only production source of accepted offers
//   - the in-memory test offer store is unreachable unless NODE_ENV=test
//   - nothing is fabricated or silently substituted when no provider exists
process.env.NODE_ENV = 'test';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const adapter = require('../src/services/offerAdapter');

const {
  registerOfferProvider,
  getAcceptedOffer,
  normalizeAndValidateOffer,
  isTestOfferStoreEnabled,
  OfferError,
  __setTestOffer,
  __clearTestOffers,
  __resetOfferProvider,
} = adapter;

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value) {
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
}

function providerFrom(map) {
  return {
    getOfferById: async (id) => map.get(id) || null,
  };
}

const ACCEPTED_OFFER = {
  offerId: 'O-1',
  farmerId: 'F-1',
  buyerId: 'B-1',
  cropName: 'Onion',
  quantity: 100,
  offeredPrice: 25,
  status: 'ACCEPTED',
};

async function assertRejects(promise, { status, code }) {
  await assert.rejects(
    promise,
    (err) => {
      assert.ok(err instanceof OfferError, `expected OfferError, got ${err.name}`);
      assert.equal(err.status, status, `expected status ${status}, got ${err.status}`);
      assert.equal(err.code, code, `expected code ${code}, got ${err.code}`);
      return true;
    }
  );
}

describe('Offer adapter — provider contract', () => {
  beforeEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
  });

  afterEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
    setNodeEnv(ORIGINAL_NODE_ENV);
  });

  test('1. registerOfferProvider rejects an object without getOfferById', () => {
    assert.throws(() => registerOfferProvider({}), /must implement getOfferById/);
    assert.throws(() => registerOfferProvider(null), /must implement getOfferById/);
  });

  test('2. a registered provider is the production source of accepted offers', async () => {
    registerOfferProvider(providerFrom(new Map([['O-1', { ...ACCEPTED_OFFER }]])));

    const offer = await getAcceptedOffer('O-1');

    assert.equal(offer.offerId, 'O-1');
    assert.equal(offer.farmerId, 'F-1');
    assert.equal(offer.buyerId, 'B-1');
    assert.equal(offer.cropName, 'Onion');
    assert.equal(offer.quantity, 100);
    assert.equal(offer.agreedPrice, 25);
    assert.equal(offer.status, 'ACCEPTED');
    assert.equal(offer.unit, 'quintal');
  });

  test('3. provider lookup trims the offerId', async () => {
    registerOfferProvider(providerFrom(new Map([['O-1', { ...ACCEPTED_OFFER }]])));
    const offer = await getAcceptedOffer('  O-1  ');
    assert.equal(offer.offerId, 'O-1');
  });

  test('4. provider returning null yields 404 OFFER_NOT_FOUND (no fallthrough)', async () => {
    registerOfferProvider(providerFrom(new Map()));
    // Even with a matching id in the test store, a registered provider is the
    // source of truth and must not be supplemented by the test store.
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-MISSING' });

    await assertRejects(getAcceptedOffer('O-MISSING'), {
      status: 404,
      code: 'OFFER_NOT_FOUND',
    });
  });

  test('5. a failing provider is reported as 502 OFFER_PROVIDER_ERROR', async () => {
    registerOfferProvider({
      getOfferById: async () => {
        throw new Error('upstream connection refused');
      },
    });

    await assertRejects(getAcceptedOffer('O-1'), {
      status: 502,
      code: 'OFFER_PROVIDER_ERROR',
    });
  });

  test('6. non-string / empty offerId is rejected before any lookup', async () => {
    await assertRejects(getAcceptedOffer(''), { status: 400, code: 'INVALID_OFFER_ID' });
    await assertRejects(getAcceptedOffer(undefined), { status: 400, code: 'INVALID_OFFER_ID' });
    await assertRejects(getAcceptedOffer(42), { status: 400, code: 'INVALID_OFFER_ID' });
  });
});

describe('Offer adapter — no fake offers outside tests', () => {
  beforeEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
  });

  afterEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
    setNodeEnv(ORIGINAL_NODE_ENV);
  });

  test('7. an offer seeded in the test store is NOT resolvable in production', async () => {
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-FAKE' });
    assert.equal(await getAcceptedOffer('O-FAKE').then((o) => o.offerId), 'O-FAKE');

    // Same process, deployed environment: the seeded fake must become invisible.
    setNodeEnv('production');
    assert.equal(isTestOfferStoreEnabled(), false);
    await assertRejects(getAcceptedOffer('O-FAKE'), {
      status: 503,
      code: 'OFFER_PROVIDER_NOT_CONFIGURED',
    });
  });

  test('8. test helpers refuse to run outside NODE_ENV=test', () => {
    for (const nodeEnv of ['production', 'development', undefined]) {
      setNodeEnv(nodeEnv);
      assert.throws(() => __setTestOffer({ ...ACCEPTED_OFFER }), /test-only helper/);
      assert.throws(() => __clearTestOffers(), /test-only helper/);
      assert.throws(() => __resetOfferProvider(), /test-only helper/);
    }
  });

  test('9. without a provider, non-test environments fail closed (503) in every env', async () => {
    for (const nodeEnv of ['production', 'development', 'staging', undefined]) {
      setNodeEnv(nodeEnv);
      await assertRejects(getAcceptedOffer('O-ANY'), {
        status: 503,
        code: 'OFFER_PROVIDER_NOT_CONFIGURED',
      });
    }
  });

  test('10. the 503 message names the missing integration instead of blaming a record', async () => {
    setNodeEnv('production');
    await assert.rejects(getAcceptedOffer('O-ANY'), (err) => {
      assert.equal(err.code, 'OFFER_PROVIDER_NOT_CONFIGURED');
      assert.match(err.message, /registerOfferProvider/);
      assert.match(err.message, /negotiation \(connection\) module/);
      return true;
    });
  });

  test('11. a registered provider keeps working in production', async () => {
    setNodeEnv('production');
    registerOfferProvider(providerFrom(new Map([['O-REAL', { ...ACCEPTED_OFFER, offerId: 'O-REAL' }]])));

    const offer = await getAcceptedOffer('O-REAL');
    assert.equal(offer.offerId, 'O-REAL');
    assert.equal(offer.agreedPrice, 25);
  });
});

describe('Offer adapter — test offer store', () => {
  beforeEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
  });

  afterEach(() => {
    setNodeEnv('test');
    __resetOfferProvider();
    __clearTestOffers();
    setNodeEnv(ORIGINAL_NODE_ENV);
  });

  test('12. isTestOfferStoreEnabled tracks NODE_ENV', () => {
    setNodeEnv('test');
    assert.equal(isTestOfferStoreEnabled(), true);
    setNodeEnv('production');
    assert.equal(isTestOfferStoreEnabled(), false);
    setNodeEnv(undefined);
    assert.equal(isTestOfferStoreEnabled(), false);
  });

  test('13. __setTestOffer accepts id or offerId and rejects neither', () => {
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: undefined, id: 'O-ID-FORM' });
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-OFFERID-FORM' });
    assert.throws(() => __setTestOffer({ farmerId: 'F-1' }), /must have an id or offerId/);
  });

  test('14. __clearTestOffers empties the store (unknown id -> 404)', async () => {
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-CLEAR' });
    __clearTestOffers();
    await assertRejects(getAcceptedOffer('O-CLEAR'), { status: 404, code: 'OFFER_NOT_FOUND' });
  });

  test('15. the store is used only when no provider is registered', async () => {
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-SEAM', quantity: 7 });
    const fromStore = await getAcceptedOffer('O-SEAM');
    assert.equal(fromStore.quantity, 7);

    registerOfferProvider(
      providerFrom(new Map([['O-SEAM', { ...ACCEPTED_OFFER, offerId: 'O-SEAM', quantity: 9 }]]))
    );
    const fromProvider = await getAcceptedOffer('O-SEAM');
    assert.equal(fromProvider.quantity, 9);
  });

  test('16. the store does not mask a non-accepted offer status', async () => {
    __setTestOffer({ ...ACCEPTED_OFFER, offerId: 'O-PENDING', status: 'PENDING' });
    await assertRejects(getAcceptedOffer('O-PENDING'), {
      status: 400,
      code: 'OFFER_NOT_ACCEPTED',
    });
  });
});

describe('Offer adapter — payload validation', () => {
  test('17. a missing offer is 404', () => {
    assert.throws(() => normalizeAndValidateOffer(null, 'O-X'), (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'OFFER_NOT_FOUND');
      return true;
    });
  });

  test('18. status must be ACCEPTED (case-insensitive)', () => {
    assert.equal(normalizeAndValidateOffer({ ...ACCEPTED_OFFER, status: 'accepted' }).status, 'ACCEPTED');
    assert.throws(() => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, status: 'REJECTED' }), (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.code, 'OFFER_NOT_ACCEPTED');
      return true;
    });
    assert.throws(() => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, status: undefined }), (err) => {
      assert.equal(err.code, 'OFFER_NOT_ACCEPTED');
      assert.match(err.message, /UNKNOWN/);
      return true;
    });
  });

  test('19. farmerId and buyerId are mandatory', () => {
    assert.throws(
      () => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, farmerId: undefined }, 'O-X'),
      (err) => {
        assert.equal(err.code, 'INVALID_OFFER');
        assert.match(err.message, /farmerId/);
        return true;
      }
    );
    assert.throws(
      () => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, buyerId: null }, 'O-X'),
      (err) => {
        assert.equal(err.code, 'INVALID_OFFER');
        assert.match(err.message, /buyerId/);
        return true;
      }
    );
  });

  test('20. quantity and price must be positive numbers', () => {
    for (const quantity of [0, -5, 'abc', null]) {
      assert.throws(
        () => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, quantity }, 'O-X'),
        (err) => {
          assert.equal(err.code, 'INVALID_QUANTITY');
          return true;
        }
      );
    }
    for (const price of [0, -1, 'abc', null]) {
      assert.throws(
        () => normalizeAndValidateOffer({ ...ACCEPTED_OFFER, offeredPrice: price }, 'O-X'),
        (err) => {
          assert.equal(err.code, 'INVALID_PRICE');
          return true;
        }
      );
    }
  });

  test('21. agreedPrice wins over offeredPrice; defaults are applied', () => {
    const explicit = normalizeAndValidateOffer({
      ...ACCEPTED_OFFER,
      offeredPrice: 10,
      agreedPrice: 12,
    });
    assert.equal(explicit.agreedPrice, 12);

    const fallback = normalizeAndValidateOffer({
      ...ACCEPTED_OFFER,
      cropId: 'C-9',
      crop: 'Tomato',
      pickupLocation: 'Nashik',
      deliveryLocation: 'Pune',
    });
    assert.equal(fallback.cropId, 'C-9');
    // cropName wins over the legacy `crop` alias.
    assert.equal(fallback.cropName, 'Onion');
    assert.equal(fallback.pickupLocation, 'Nashik');
    assert.equal(fallback.deliveryLocation, 'Pune');

    // `crop` is only used when cropName is absent.
    const cropAlias = normalizeAndValidateOffer({
      ...ACCEPTED_OFFER,
      cropName: undefined,
      crop: 'Tomato',
    });
    assert.equal(cropAlias.cropName, 'Tomato');

    const minimal = normalizeAndValidateOffer({
      offerId: 'O-MIN',
      farmerId: 'F-2',
      buyerId: 'B-2',
      quantity: 5,
      offeredPrice: 3,
      status: 'ACCEPTED',
    });
    assert.equal(minimal.cropName, 'Agricultural Produce');
    assert.equal(minimal.unit, 'quintal');
    assert.equal(minimal.cropId, null);
    assert.equal(minimal.pickupLocation, null);
    assert.equal(minimal.deliveryLocation, null);
    assert.equal(minimal.offerId, 'O-MIN');
  });
});
