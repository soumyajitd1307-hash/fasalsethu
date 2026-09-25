// Matching Service — transparent match score calculation between CropListing and BuyerRequirements (B2 Step 4).
const { getPrisma } = require('../config/database');
const { calculateMidPrice, comparePriceWithUnits, normalizeUnitKey } = require('./priceDiscoveryService');

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

function getUnitFactor(unit) {
  const norm = normalizeUnitKey(unit);
  return UNIT_FACTOR_TO_KG[norm] || null;
}

function convertQuantity(qty, fromUnit, toUnit) {
  if (qty === null || qty === undefined || Number.isNaN(Number(qty))) return null;
  const normFrom = normalizeUnitKey(fromUnit);
  const normTo = normalizeUnitKey(toUnit);
  if (normFrom && normTo && normFrom === normTo) return Number(qty);
  const fFrom = getUnitFactor(fromUnit);
  const fTo = getUnitFactor(toUnit);
  if (fFrom && fTo) {
    return Number(qty) * (fFrom / fTo);
  }
  return null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
  ) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (Number.isNaN(nLat1) || Number.isNaN(nLon1) || Number.isNaN(nLat2) || Number.isNaN(nLon2)) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function calculateMatchScore(listing, req) {
  const reasons = [];

  // 1. Crop Match (25 pts)
  const cropScore = 25;
  reasons.push('Crop matches');

  // 2. Quantity Compatibility (20 pts)
  let quantityScore = 0;
  const convertedReqQty = convertQuantity(req.requiredQuantity, req.unit, listing.unit);

  if (convertedReqQty !== null) {
    if (convertedReqQty >= listing.quantity) {
      quantityScore = 20;
      reasons.push('Buyer requirement can absorb full listing quantity');
    } else {
      const ratio = convertedReqQty / listing.quantity;
      quantityScore = Math.round(ratio * 20 * 100) / 100;
      reasons.push(`Buyer requirement can absorb partial listing quantity (${Math.round(convertedReqQty * 100) / 100} / ${listing.quantity} ${listing.unit})`);
    }
  } else {
    reasons.push(`Units incompatible (${req.unit} vs ${listing.unit})`);
  }

  // 3. Price Compatibility (25 pts)
  const midPrice = calculateMidPrice(listing.minExpectedPrice, listing.maxExpectedPrice);
  const priceComp = comparePriceWithUnits(req.targetPrice, req.unit, midPrice, listing.unit);

  let priceScore = 0;
  let priceDiff = null;
  let priceDiffPct = null;

  if (priceComp.unitMatch && req.targetPrice !== null && req.targetPrice !== undefined) {
    priceDiff = priceComp.priceDifference;
    priceDiffPct = priceComp.priceDifferencePercent;

    const reqUnitFactor = getUnitFactor(req.unit) || 1;
    const listingUnitFactor = getUnitFactor(listing.unit) || 1;
    const targetPriceConverted = req.targetPrice * (listingUnitFactor / reqUnitFactor);

    const minP = Number(listing.minExpectedPrice) || 0;
    const maxP = Number(listing.maxExpectedPrice) || 0;

    if (targetPriceConverted >= minP && targetPriceConverted <= maxP) {
      priceScore = 25;
      reasons.push('Buyer target price is within farmer expected price range');
    } else if (targetPriceConverted > maxP) {
      priceScore = 25;
      reasons.push('Buyer target price is above farmer expected price range');
    } else {
      if (minP === 0) {
        priceScore = 25;
      } else {
        const rawScore = (targetPriceConverted / minP) * 25;
        priceScore = Math.max(0, Math.min(25, Math.round(rawScore * 100) / 100));
      }
    }
  }

  // 4. Distance (15 pts)
  const farmerLat = listing.latitude !== null && listing.latitude !== undefined ? listing.latitude : (listing.farmer && listing.farmer.latitude);
  const farmerLon = listing.longitude !== null && listing.longitude !== undefined ? listing.longitude : (listing.farmer && listing.farmer.longitude);

  const buyerLat = req.latitude !== null && req.latitude !== undefined ? req.latitude : (req.buyer && req.buyer.latitude);
  const buyerLon = req.longitude !== null && req.longitude !== undefined ? req.longitude : (req.buyer && req.buyer.longitude);

  const distanceKm = haversineDistanceKm(farmerLat, farmerLon, buyerLat, buyerLon);

  let distanceScore = 0;
  if (distanceKm !== null) {
    if (distanceKm <= 10) {
      distanceScore = 15;
      reasons.push(`Buyer is ${distanceKm} km away (within 10 km)`);
    } else if (distanceKm <= 25) {
      distanceScore = 12;
      reasons.push(`Buyer is ${distanceKm} km away (within 25 km)`);
    } else if (distanceKm <= 50) {
      distanceScore = 9;
      reasons.push(`Buyer is ${distanceKm} km away (within 50 km)`);
    } else if (distanceKm <= 100) {
      distanceScore = 5;
      reasons.push(`Buyer is ${distanceKm} km away (within 100 km)`);
    } else {
      distanceScore = 2;
      reasons.push(`Buyer is ${distanceKm} km away`);
    }
  }

  // 5. Trust / Quality (15 pts)
  // Safe neutral score (7.5 out of 15) because buyer trust data is unassessed/unavailable.
  const trustScore = 7.5;

  const total = Math.round((cropScore + quantityScore + priceScore + distanceScore + trustScore) * 100) / 100;

  return {
    score: {
      total,
      crop: cropScore,
      quantity: quantityScore,
      price: priceScore,
      distance: distanceScore,
      trust: trustScore,
    },
    distanceKm,
    unitMatch: priceComp.unitMatch,
    trustScoreAvailable: false,
    priceComparison: {
      difference: priceDiff,
      differencePercent: priceDiffPct,
    },
    matchReasons: reasons,
  };
}

async function getMatchesForCropListing(cropListingId) {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();

  const listing = await prisma.cropListing.findUnique({
    where: { id: cropListingId },
    include: {
      farmer: {
        select: { id: true, name: true, phone: true, village: true, district: true, state: true, latitude: true, longitude: true },
      },
    },
  });

  if (!listing) {
    throw listingNotFound(cropListingId);
  }

  const listingCropNorm = listing.cropName.trim().toLowerCase();
  const cropToken = listingCropNorm.split(/[\s(]/)[0].trim();

  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: {
      status: 'OPEN',
      cropName: { contains: cropToken, mode: 'insensitive' },
    },
    include: {
      buyer: {
        select: { id: true, name: true, companyName: true, latitude: true, longitude: true },
      },
    },
  });

  const filteredReqs = buyerReqs.filter((req) => {
    if (req.status !== 'OPEN') return false;
    const reqCropNorm = (req.cropName || '').trim().toLowerCase();
    return reqCropNorm.includes(cropToken) || listingCropNorm.includes(reqCropNorm);
  });

  const matches = filteredReqs.map((req) => {
    const buyerName = (req.buyer && (req.buyer.companyName || req.buyer.name)) || 'Unknown Buyer';
    const companyName = req.buyer ? req.buyer.companyName : null;
    const matchRes = calculateMatchScore(listing, req);

    return {
      buyerRequirementId: req.id,
      buyerId: req.buyerId,
      buyerName,
      companyName,
      cropName: req.cropName,
      requiredQuantity: req.requiredQuantity,
      unit: req.unit,
      targetPrice: req.targetPrice,
      distanceKm: matchRes.distanceKm,
      unitMatch: matchRes.unitMatch,
      trustScoreAvailable: false,
      score: matchRes.score,
      priceComparison: matchRes.priceComparison,
      matchReasons: matchRes.matchReasons,
    };
  });

  matches.sort((a, b) => {
    if (b.score.total !== a.score.total) {
      return b.score.total - a.score.total;
    }
    if (a.distanceKm !== null && b.distanceKm !== null) {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    } else if (a.distanceKm !== null) {
      return -1;
    } else if (b.distanceKm !== null) {
      return 1;
    }
    if (b.targetPrice !== a.targetPrice) {
      return (b.targetPrice || 0) - (a.targetPrice || 0);
    }
    return a.buyerRequirementId.localeCompare(b.buyerRequirementId);
  });

  return {
    cropListing: {
      id: listing.id,
      cropName: listing.cropName,
      quantity: listing.quantity,
      unit: listing.unit,
      minExpectedPrice: listing.minExpectedPrice,
      maxExpectedPrice: listing.maxExpectedPrice,
    },
    matches,
  };
}

module.exports = {
  haversineDistanceKm,
  convertQuantity,
  calculateMatchScore,
  getMatchesForCropListing,
};
