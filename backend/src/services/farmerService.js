// Farmer service — all Farmer DB/business logic lives here (B1 Task 2).
// Controllers stay thin; Prisma errors are converted to clean HTTP errors.
const { getPrisma } = require('../config/database');

function notFound(id) {
  const err = new Error(`Farmer not found: ${id}`);
  err.status = 404;
  return err;
}

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

// Map raw Prisma errors to clean API errors (never leak DB internals).
function toApiError(err, id) {
  if (err && err.code === 'P2002') {
    const fields = Array.isArray(err.meta && err.meta.target)
      ? err.meta.target.join(', ')
      : 'unique field';
    const conflict = new Error(`Farmer with this ${fields} already exists`);
    conflict.status = 409;
    return conflict;
  }
  if (err && err.code === 'P2025') {
    return notFound(id);
  }
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

async function createFarmer(data) {
  const prisma = clientOrThrow();
  try {
    return await prisma.farmer.create({ data });
  } catch (err) {
    throw toApiError(err);
  }
}

async function getAllFarmers({ page, limit }) {
  const prisma = clientOrThrow();
  const skip = (page - 1) * limit;
  const [rows, total] = await prisma.$transaction([
    prisma.farmer.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.farmer.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getFarmerById(id) {
  const prisma = clientOrThrow();
  const farmer = await prisma.farmer.findUnique({ where: { id } });
  if (!farmer) throw notFound(id);
  return farmer;
}

async function updateFarmer(id, data) {
  const prisma = clientOrThrow();
  try {
    return await prisma.farmer.update({ where: { id }, data });
  } catch (err) {
    throw toApiError(err, id);
  }
}

async function deleteFarmer(id) {
  const prisma = clientOrThrow();
  try {
    return await prisma.farmer.delete({ where: { id } });
  } catch (err) {
    throw toApiError(err, id);
  }
}

module.exports = {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
};
