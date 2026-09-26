// BuyerRequirement service — all BuyerRequirement DB/business logic lives here (B2 Step 2).
// Every requirement must belong to an existing buyer (no orphans).
const { getPrisma } = require('../config/database');

function requirementNotFound(id) {
  const err = new Error(`Buyer requirement not found: ${id}`);
  err.status = 404;
  return err;
}

function buyerNotFound(buyerId) {
  const err = new Error(`Buyer not found: ${buyerId}`);
  err.status = 404;
  return err;
}

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

// Map raw Prisma errors to clean API errors (never leak DB internals).
function toApiError(err, id, buyerId) {
  if (err && err.code === 'P2002') {
    const fields = Array.isArray(err.meta && err.meta.target)
      ? err.meta.target.join(', ')
      : 'unique field';
    const conflict = new Error(`Buyer requirement with this ${fields} already exists`);
    conflict.status = 409;
    return conflict;
  }
  if (err && err.code === 'P2025') {
    return requirementNotFound(id);
  }
  if (err && (err.code === 'P2003' || err.code === 'P2014')) {
    return buyerNotFound(buyerId);
  }
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

async function assertBuyerExists(prisma, buyerId) {
  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
  if (!buyer) throw buyerNotFound(buyerId);
}

// Limited buyer info embedded in single-requirement reads (no sensitive data).
const buyerSelect = {
  select: { id: true, name: true, companyName: true, phone: true, buyerType: true, village: true, district: true, state: true },
};

async function createBuyerRequirement(data) {
  const prisma = clientOrThrow();
  await assertBuyerExists(prisma, data.buyerId);
  try {
    return await prisma.buyerRequirement.create({ data });
  } catch (err) {
    throw toApiError(err, undefined, data.buyerId);
  }
}

async function getAllBuyerRequirements({ page, limit }) {
  const prisma = clientOrThrow();
  const skip = (page - 1) * limit;
  const [rows, total] = await prisma.$transaction([
    prisma.buyerRequirement.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.buyerRequirement.count(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

async function getBuyerRequirementById(id) {
  const prisma = clientOrThrow();
  const requirement = await prisma.buyerRequirement.findUnique({
    where: { id },
    include: { buyer: buyerSelect },
  });
  if (!requirement) throw requirementNotFound(id);
  return requirement;
}

async function updateBuyerRequirement(id, data) {
  const prisma = clientOrThrow();
  if (data.buyerId !== undefined) {
    await assertBuyerExists(prisma, data.buyerId);
  }
  try {
    return await prisma.buyerRequirement.update({ where: { id }, data });
  } catch (err) {
    throw toApiError(err, id, data.buyerId);
  }
}

async function deleteBuyerRequirement(id) {
  const prisma = clientOrThrow();
  try {
    return await prisma.buyerRequirement.delete({ where: { id } });
  } catch (err) {
    throw toApiError(err, id);
  }
}

module.exports = {
  createBuyerRequirement,
  getAllBuyerRequirements,
  getBuyerRequirementById,
  updateBuyerRequirement,
  deleteBuyerRequirement,
};
