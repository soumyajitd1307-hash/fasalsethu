// Buyer service — all Buyer DB/business logic lives here (B2 Step 2).
// Controllers stay thin; Prisma errors are converted to clean HTTP errors.
const { getPrisma } = require('../config/database');

function notFound(id) {
  const err = new Error(`Buyer not found: ${id}`);
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
    const conflict = new Error(`Buyer with this ${fields} already exists`);
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

async function createBuyer(data) {
  const prisma = clientOrThrow();
  try {
    return await prisma.buyer.create({ data });
  } catch (err) {
    throw toApiError(err);
  }
}

async function getAllBuyers({ page, limit }) {
  const prisma = clientOrThrow();
  const skip = (page - 1) * limit;
  const [rows, total] = await prisma.$transaction([
    prisma.buyer.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.buyer.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getBuyerById(id) {
  const prisma = clientOrThrow();
  const buyer = await prisma.buyer.findUnique({ where: { id } });
  if (!buyer) throw notFound(id);
  return buyer;
}

async function updateBuyer(id, data) {
  const prisma = clientOrThrow();
  try {
    return await prisma.buyer.update({ where: { id }, data });
  } catch (err) {
    throw toApiError(err, id);
  }
}

async function deleteBuyer(id) {
  const prisma = clientOrThrow();
  try {
    return await prisma.buyer.delete({ where: { id } });
  } catch (err) {
    throw toApiError(err, id);
  }
}

module.exports = {
  createBuyer,
  getAllBuyers,
  getBuyerById,
  updateBuyer,
  deleteBuyer,
};
