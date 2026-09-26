// Price Discovery Controller — thin layer over priceDiscoveryService (B2 Step 3).
const priceDiscoveryService = require('../services/priceDiscoveryService');

async function getPriceDiscovery(req, res, next) {
  try {
    const { cropListingId } = req.params;
    const data = await priceDiscoveryService.getPriceDiscovery(cropListingId);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { getPriceDiscovery };
