// Matching controller — thin layer over matchingService (B2 Step 4).
const matchingService = require('../services/matchingService');

async function getMatchesForCropListing(req, res, next) {
  try {
    const { cropListingId } = req.params;
    const data = await matchingService.getMatchesForCropListing(cropListingId);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
  return undefined;
}

module.exports = { getMatchesForCropListing };
