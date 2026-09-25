/**
 * B2 Integration Contract — Offer Adapter Interface
 * 
 * Provides a decoupled service boundary between B2 (Matching & Offers)
 * and B3 (Deal / Transaction Management).
 * 
 * When B2 completes the Offer Service/table, B2 can register its provider
 * via `registerOfferProvider(provider)` without modifying B3 business logic.
 */

class OfferError extends Error {
  constructor(message, status = 400, code = 'OFFER_ERROR') {
    super(message);
    this.name = 'OfferError';
    this.status = status;
    this.code = code;
  }
}

// In-memory test/mock provider registry
let externalOfferProvider = null;
const testOfferStore = new Map();

/**
 * Register an external B2 offer provider (e.g., Prisma query or B2 OfferService).
 * @param {Object} provider - Must implement `getOfferById(offerId): Promise<Offer>`
 */
function registerOfferProvider(provider) {
  if (provider && typeof provider.getOfferById === 'function') {
    externalOfferProvider = provider;
  } else {
    throw new Error('Offer provider must implement getOfferById(offerId)');
  }
}

/**
 * Isolated test helper: add offer to test store (used during automated tests).
 */
function __setTestOffer(offer) {
  const id = offer.id || offer.offerId;
  if (!id) throw new Error('Test offer must have an id or offerId');
  testOfferStore.set(id, { ...offer, id });
}

/**
 * Isolated test helper: clear test store.
 */
function __clearTestOffers() {
  testOfferStore.clear();
}

/**
 * Validates and normalizes an accepted offer contract payload.
 * Expected structure from B2:
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
    const err = new OfferError(`Offer not found: ${offerId}`, 404, 'OFFER_NOT_FOUND');
    throw err;
  }

  const id = rawOffer.id || rawOffer.offerId || offerId;
  const status = (rawOffer.status || '').toUpperCase();

  if (status !== 'ACCEPTED') {
    const err = new OfferError(
      `Offer ${id} cannot be converted to a deal because its status is '${status || 'UNKNOWN'}' (must be 'ACCEPTED')`,
      400,
      'OFFER_NOT_ACCEPTED'
    );
    throw err;
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
  const agreedPrice = Number(rawOffer.agreedPrice !== undefined ? rawOffer.agreedPrice : rawOffer.offeredPrice);

  if (isNaN(quantity) || quantity <= 0) {
    throw new OfferError(`Offer ${id} has invalid quantity (${rawOffer.quantity})`, 400, 'INVALID_QUANTITY');
  }

  if (isNaN(agreedPrice) || agreedPrice <= 0) {
    throw new OfferError(`Offer ${id} has invalid price (${rawOffer.offeredPrice || rawOffer.agreedPrice})`, 400, 'INVALID_PRICE');
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
 * Retrieves and validates an accepted offer from B2.
 * @param {string} offerId
 * @returns {Promise<Object>} normalized accepted offer
 */
async function getAcceptedOffer(offerId) {
  if (!offerId || typeof offerId !== 'string') {
    throw new OfferError('Valid offerId string is required', 400, 'INVALID_OFFER_ID');
  }

  const cleanId = offerId.trim();

  // 1. Check external provider if registered
  if (externalOfferProvider) {
    try {
      const raw = await externalOfferProvider.getOfferById(cleanId);
      if (raw) {
        return normalizeAndValidateOffer(raw, cleanId);
      }
    } catch (err) {
      if (err instanceof OfferError) throw err;
      throw new OfferError(`Error fetching offer from B2 provider: ${err.message}`, 502, 'B2_PROVIDER_ERROR');
    }
  }

  // 2. Check isolated test store
  if (testOfferStore.has(cleanId)) {
    const raw = testOfferStore.get(cleanId);
    return normalizeAndValidateOffer(raw, cleanId);
  }

  // 3. Offer not found
  throw new OfferError(`Offer not found: ${cleanId}`, 404, 'OFFER_NOT_FOUND');
}

module.exports = {
  OfferError,
  registerOfferProvider,
  getAcceptedOffer,
  normalizeAndValidateOffer,
  __setTestOffer,
  __clearTestOffers,
};
