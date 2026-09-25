// Prisma is the source of truth for models.
// Tables: farmers, buyers, crop_listings, buyer_requirements (see prisma/schema.prisma).
// Relations:
//   Farmer 1—N CropListing  (CropListing.farmerId -> Farmer.id, onDelete Cascade)
//   Buyer  1—N BuyerRequirement (BuyerRequirement.buyerId -> Buyer.id, onDelete Cascade)
const { getPrisma } = require('../config/database');

module.exports = { getPrisma };
