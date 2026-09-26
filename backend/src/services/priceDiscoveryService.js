// Price Discovery Service — transparent price comparison for crop listings (B2 Step 3).
// Compares farmer expected price, buyer target prices, and mandi market prices.
const { getPrisma } = require('../config/database');

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

function listingNotFound(id) {
  const err = new Error(`Crop listing not found: ${id}`);
  err.status = 404;
  return err;
}

const UNIT_FACTOR_TO_KG = {
  kg: 1,
  kilogram: 1,
  kilograms: 1,
  quintal: 100,
  qtl: 100,
  quintals: 100,
  q: 100,
  tonne: 1000,
  ton: 1000,
  tonnes: 1000,
  mt: 1000,
};

function normalizeUnitKey(unit) {
  if (!unit || typeof unit !== 'string') return null;
  const u = unit.trim().toLowerCase();
  if (UNIT_FACTOR_TO_KG[u]) return u;
  if (/(quintal|^qtl$|\bq\b)/.test(u)) return 'quintal';
  if (/(^kg$|per kg|\/kg|kilogram)/.test(u)) return 'kg';
  if (/tonne|metric|^\bmt\b|ton/.test(u)) return 'tonne';
  return u;
}

function getUnitFactor(unit) {
  const norm = normalizeUnitKey(unit);
  return UNIT_FACTOR_TO_KG[norm] || null;
}

function comparePriceWithUnits(targetPrice, targetUnit, baseMidPrice, baseUnit) {
  if (targetPrice === null || targetPrice === undefined || Number.isNaN(Number(targetPrice))) {
    return { priceDifference: null, priceDifferencePercent: null, unitMatch: false };
  }

  const normTarget = normalizeUnitKey(targetUnit);
  const normBase = normalizeUnitKey(baseUnit);

  if (normTarget && normBase && normTarget === normBase) {
    const diff = targetPrice - baseMidPrice;
    const roundedDiff = Math.round(diff * 100) / 100;
    const percent = baseMidPrice === 0 ? 0 : Math.round((diff / baseMidPrice) * 10000) / 100;
    return { priceDifference: roundedDiff, priceDifferencePercent: percent, unitMatch: true };
  }

  const targetFactor = getUnitFactor(targetUnit);
  const baseFactor = getUnitFactor(baseUnit);

  if (targetFactor && baseFactor) {
    const normalizedTargetPrice = targetPrice * (baseFactor / targetFactor);
    const diff = normalizedTargetPrice - baseMidPrice;
    const roundedDiff = Math.round(diff * 100) / 100;
    const percent = baseMidPrice === 0 ? 0 : Math.round((diff / baseMidPrice) * 10000) / 100;
    return { priceDifference: roundedDiff, priceDifferencePercent: percent, unitMatch: true };
  }

  return { priceDifference: null, priceDifferencePercent: null, unitMatch: false };
}

function calculateMidPrice(minExpectedPrice, maxExpectedPrice) {
  const minP = Number(minExpectedPrice) || 0;
  const maxP = Number(maxExpectedPrice) || 0;
  return Math.round(((minP + maxP) / 2) * 100) / 100;
}

async function getPriceDiscovery(cropListingId) {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();

  const cropListing = await prisma.cropListing.findUnique({
    where: { id: cropListingId },
    include: {
      farmer: {
        select: { id: true, name: true, phone: true, village: true, district: true, state: true },
      },
    },
  });

  if (!cropListing) {
    throw listingNotFound(cropListingId);
  }

  const midPrice = calculateMidPrice(cropListing.minExpectedPrice, cropListing.maxExpectedPrice);
  const cropUnit = cropListing.unit;

  // Extract base crop token (e.g. "Onion" from "Onion (Nashik Red)")
  const cropToken = cropListing.cropName.split(/[\s(]/)[0].trim();

  // Find matching buyer requirements
  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: {
      status: 'OPEN',
      cropName: { contains: cropToken, mode: 'insensitive' },
    },
    include: {
      buyer: {
        select: { id: true, name: true, companyName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const buyerPrices = buyerReqs.map((req) => {
    const buyerName = (req.buyer && (req.buyer.companyName || req.buyer.name)) || 'Unknown Buyer';
    const comp = comparePriceWithUnits(req.targetPrice, req.unit, midPrice, cropUnit);

    return {
      buyerRequirementId: req.id,
      buyerId: req.buyerId,
      buyerName,
      targetPrice: req.targetPrice,
      requiredQuantity: req.requiredQuantity,
      unit: req.unit,
      priceDifference: comp.priceDifference,
      priceDifferencePercent: comp.priceDifferencePercent,
      unitMatch: comp.unitMatch,
    };
  });

  // Find latest market price
  const marketRec = await prisma.marketPrice.findFirst({
    where: {
      commodity: { contains: cropToken, mode: 'insensitive' },
    },
    orderBy: { observedAt: 'desc' },
  });

  let marketPrice = {
    minPrice: null,
    maxPrice: null,
    modalPrice: null,
    unit: null,
    market: null,
    source: null,
    observedAt: null,
    priceDifference: null,
    priceDifferencePercent: null,
    unitMatch: false,
  };

  if (marketRec) {
    const effectivePrice = marketRec.modalPrice !== null && marketRec.modalPrice !== undefined
      ? marketRec.modalPrice
      : marketRec.minPrice;

    const comp = comparePriceWithUnits(effectivePrice, marketRec.unit, midPrice, cropUnit);

    marketPrice = {
      minPrice: marketRec.minPrice,
      maxPrice: marketRec.maxPrice,
      modalPrice: marketRec.modalPrice,
      unit: marketRec.unit,
      market: marketRec.market,
      source: marketRec.source,
      observedAt: marketRec.observedAt,
      priceDifference: comp.priceDifference,
      priceDifferencePercent: comp.priceDifferencePercent,
      unitMatch: comp.unitMatch,
    };
  }

  return {
    cropListing,
    farmerPrice: {
      minExpectedPrice: cropListing.minExpectedPrice,
      maxExpectedPrice: cropListing.maxExpectedPrice,
      midPrice,
      unit: cropListing.unit,
    },
    marketPrice,
    buyerPrices,
  };
}

module.exports = {
  calculateMidPrice,
  comparePriceWithUnits,
  normalizeUnitKey,
  getPriceDiscovery,
};
