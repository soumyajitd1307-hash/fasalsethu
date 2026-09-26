/**
 * Offer Adapter — the B3 boundary for resolving an accepted offer.
 *
 * WHAT `offerId` IS
 * -----------------
 * A Deal (B3) is only ever created from an already-accepted offer. `offerId` is
 * the opaque business key of that accepted offer. It is the duplicate-deal guard
 * (`deals.offer_id` is UNIQUE) and it is echoed onto the deal's notifications.
 *
 * It is NOT a foreign key. There is no `offers` table in this repository, and
 * there never has been one on any branch — `offerId` is a cross-module business
 * key, not a reference to a local Offer row.
 *
 * WHO OWNS OFFERS
 * ---------------
 * Neither B1 nor B2 produces offers:
 *   - B1 persists CropListing, BuyerRequirement and MarketPrice.
 *   - B2 (matchingService / priceDiscoveryService) is read-only: it *computes*
 *     match scores and price comparisons and writes nothing. A match is a
 *     score, not a commitment, so matching is not an offer.
 *
 * The flow that produces accepted offers is the negotiation / connection module
 * (docs/API_CONTRACT_M5.md section 4: PROPOSE_DEAL -> COUNTER_OFFER ->
 * ACCEPT_DEAL -> COMPLETE_DEAL), which is a separate module with its own data
 * model and is not implemented in this backend yet.
 *
 * So this file is an integration seam, not a stub database. The negotiation
 * module registers a real provider with `registerOfferProvider()`. Until one is
 * registered, deal creation fails loudly with 503 OFFER_PROVIDER_NOT_CONFIGURED
 * — it never fabricates an offer, never guesses, and never silently substitutes
 * in-memory data for a persistent offer.
 *
 * The only in-memory offer store in this file is a TEST seam. It is unreachable
 * unless `NODE_ENV === 'test'`, so no fake offer record can exist in a deployed
 * environment.
 */

class OfferError extends Error {
  constructor(message, status = 400, code = 'OFFER_ERROR') {
    super(message);
    this.name = 'OfferError';
    this.status = status;
    this.code = code;
  }
}

// Production provider (registered by the negotiation/connection module).
let externalOfferProvider = null;

// Test-only store. Never consulted unless isTestOfferStoreEnabled() is true.
const testOfferStore = new Map();

/**
 * Resolved per call rather than at import time, so that no code path can enable
 * the fake store by importing this module before the environment is known.
 */
function isTestOfferStoreEnabled() {
  return process.env.NODE_ENV === 'test';
}

function assertTestOnly(fnName) {
  if (!isTestOfferStoreEnabled()) {
    throw new Error(
      `${fnName} is a test-only helper and is disabled unless NODE_ENV=test ` +
        `(current NODE_ENV: ${process.env.NODE_ENV || 'unset'})`
    );
  }
}

/**
 * Registers the production offer provider (the negotiation/connection module).
 * The provider is the only source of accepted offers in a deployed environment.
 * @param {Object} provider - Must implement `getOfferById(offerId): Promise<Offer|null>`
 */
function registerOfferProvider(provider) {
  if (!provider || typeof provider.getOfferById !== 'function') {
    throw new Error('Offer provider must implement getOfferById(offerId)');
  }
  externalOfferProvider = provider;
}

/**
 * Test helper: remove the registered provider (restores the unconfigured state).
 */
function __resetOfferProvider() {
  assertTestOnly('__resetOfferProvider');
  externalOfferProvider = null;
}

/**
 * Test helper: seed an accepted offer (test runs only).
 */
function __setTestOffer(offer) {
  assertTestOnly('__setTestOffer');
  const id = offer.id || offer.offerId;
  if (!id) throw new Error('Test offer must have an id or offerId');
  testOfferStore.set(id, { ...offer, id });
}

/**
 * Test helper: clear the test offer store.
 */
function __clearTestOffers() {
  assertTestOnly('__clearTestOffers');
  testOfferStore.clear();
}

/**
 * Validates and normalizes an accepted offer payload.
 * Expected shape from the offer provider:
 * {
 *   "offerId": "O123",
 *   "farmerId": "F101",
 *   "buyerId": "B201",
 *   "cropId": "C301",
 *   "cropName": "Onion",
 *   "quantity": 500,
 *   "offeredPrice": 28,
 *   "status": "ACCEPTED"
 * }
 */
function normalizeAndValidateOffer(rawOffer, offerId) {
  if (!rawOffer) {
    throw new OfferError(`Offer not found: ${offerId}`, 404, 'OFFER_NOT_FOUND');
  }

  const id = rawOffer.id || rawOffer.offerId || offerId;
  const status = (rawOffer.status || '').toUpperCase();

  if (status !== 'ACCEPTED') {
    throw new OfferError(
      `Offer ${id} cannot be converted to a deal because its status is '${status || 'UNKNOWN'}' (must be 'ACCEPTED')`,
      400,
      'OFFER_NOT_ACCEPTED'
    );
  }

  const farmerId = rawOffer.farmerId;
  const buyerId = rawOffer.buyerId;

  if (!farmerId) {
    throw new OfferError(`Offer ${id} is missing required farmerId`, 400, 'INVALID_OFFER');
  }
  if (!buyerId) {
    throw new OfferError(`Offer ${id} is missing required buyerId`, 400, 'INVALID_OFFER');
  }

  const quantity = Number(rawOffer.quantity);
  const agreedPrice = Number(
    rawOffer.agreedPrice !== undefined ? rawOffer.agreedPrice : rawOffer.offeredPrice
  );

  if (isNaN(quantity) || quantity <= 0) {
    throw new OfferError(
      `Offer ${id} has invalid quantity (${rawOffer.quantity})`,
      400,
      'INVALID_QUANTITY'
    );
  }

  if (isNaN(agreedPrice) || agreedPrice <= 0) {
    throw new OfferError(
      `Offer ${id} has invalid price (${rawOffer.agreedPrice || rawOffer.offeredPrice})`,
      400,
      'INVALID_PRICE'
    );
  }

  return {
    offerId: id,
    farmerId,
    buyerId,
    cropId: rawOffer.cropId || null,
    cropName: rawOffer.cropName || rawOffer.crop || 'Agricultural Produce',
    quantity,
    unit: rawOffer.unit || 'quintal',
    agreedPrice,
    status: 'ACCEPTED',
    pickupLocation: rawOffer.pickupLocation || null,
    deliveryLocation: rawOffer.deliveryLocation || null,
  };
}

/**
 * Resolves an accepted offer. Production path first (registered provider), then
 * the test store (test runs only). Never falls back to fabricated data.
 * @param {string} offerId
 * @returns {Promise<Object>} normalized accepted offer
 */
async function getAcceptedOffer(offerId) {
  if (!offerId || typeof offerId !== 'string') {
    throw new OfferError('Valid offerId string is required', 400, 'INVALID_OFFER_ID');
  }

  const cleanId = offerId.trim();

  // 1. Registered provider (production).
  if (externalOfferProvider) {
    let raw;
    try {
      raw = await externalOfferProvider.getOfferById(cleanId);
    } catch (err) {
      if (err instanceof OfferError) throw err;
      throw new OfferError(
        `Error fetching offer from the registered offer provider: ${err.message}`,
        502,
        'OFFER_PROVIDER_ERROR'
      );
    }
    if (!raw) {
      throw new OfferError(`Offer not found: ${cleanId}`, 404, 'OFFER_NOT_FOUND');
    }
    return normalizeAndValidateOffer(raw, cleanId);
  }

  // 2. Test store (reachable only when NODE_ENV=test).
  if (isTestOfferStoreEnabled()) {
    if (testOfferStore.has(cleanId)) {
      return normalizeAndValidateOffer(testOfferStore.get(cleanId), cleanId);
    }
    throw new OfferError(`Offer not found: ${cleanId}`, 404, 'OFFER_NOT_FOUND');
  }

  // 3. No provider and no test store: fail loudly instead of inventing an offer.
  throw new OfferError(
    'No offer provider is registered, so accepted offers cannot be resolved. ' +
      'Deal creation requires the negotiation (connection) module to register a ' +
      'provider via registerOfferProvider().',
    503,
    'OFFER_PROVIDER_NOT_CONFIGURED'
  );
}

module.exports = {
  OfferError,
  registerOfferProvider,
  getAcceptedOffer,
  normalizeAndValidateOffer,
  isTestOfferStoreEnabled,
  __setTestOffer,
  __clearTestOffers,
  __resetOfferProvider,
};
