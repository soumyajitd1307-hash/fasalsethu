// Crop Listing service — all CropListing DB/business logic lives here (B1 Task 3).
// Follows the Farmer service pattern: Prisma errors become clean HTTP errors.
// Every listing must belong to an existing farmer (no orphans).
const { getPrisma } = require('../config/database');

function listingNotFound(id) {
  const err = new Error(`Crop listing not found: ${id}`);
  err.status = 404;
  return err;
}

function farmerNotFound(farmerId) {
  const err = new Error(`Farmer not found: ${farmerId}`);
  err.status = 404;
  return err;
}

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

// Map raw Prisma errors to clean API errors (never leak DB internals).
function toApiError(err, id, farmerId) {
  if (err && err.code === 'P2002') {
    const fields = Array.isArray(err.meta && err.meta.target)
      ? err.meta.target.join(', ')
      : 'unique field';
    const conflict = new Error(`Crop listing with this ${fields} already exists`);
    conflict.status = 409;
    return conflict;
  }
  if (err && err.code === 'P2025') {
    return listingNotFound(id);
  }
  if (err && (err.code === 'P2003' || err.code === 'P2014')) {
    return farmerNotFound(farmerId);
  }
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

async function assertFarmerExists(prisma, farmerId) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) throw farmerNotFound(farmerId);
}

// Limited farmer info embedded in single-listing reads (no sensitive data).
const farmerSelect = {
  select: { id: true, name: true, phone: true, village: true, district: true, state: true },
};

async function createCropListing(data) {
  const prisma = clientOrThrow();
  await assertFarmerExists(prisma, data.farmerId);
  try {
    return await prisma.cropListing.create({ data });
  } catch (err) {
    throw toApiError(err, undefined, data.farmerId);
  }
}

async function getAllCropListings({ page, limit }) {
  const prisma = clientOrThrow();
  const skip = (page - 1) * limit;
  const [rows, total] = await prisma.$transaction([
    prisma.cropListing.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cropListing.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getCropListingById(id) {
  const prisma = clientOrThrow();
  const listing = await prisma.cropListing.findUnique({
    where: { id },
    include: { farmer: farmerSelect },
  });
  if (!listing) throw listingNotFound(id);
  return listing;
}

async function updateCropListing(id, data) {
  const prisma = clientOrThrow();
  if (data.farmerId !== undefined) {
    await assertFarmerExists(prisma, data.farmerId);
  }
  try {
    return await prisma.cropListing.update({ where: { id }, data });
  } catch (err) {
    throw toApiError(err, id, data.farmerId);
  }
}

async function deleteCropListing(id) {
  const prisma = clientOrThrow();
  try {
    // Deletes only the listing; the farmer record is untouched.
    return await prisma.cropListing.delete({ where: { id } });
  } catch (err) {
    throw toApiError(err, id);
  }
}

module.exports = {
  createCropListing,
  getAllCropListings,
  getCropListingById,
  updateCropListing,
  deleteCropListing,
};
