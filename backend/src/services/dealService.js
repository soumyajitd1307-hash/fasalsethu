/**
 * Deal & Transaction Service (B3 Task)
 *
 * Core business logic for agricultural deals / transactions:
 * 1. Consumes accepted offers via B2 OfferAdapter.
 * 2. Enforces duplicate deal protection (409 Conflict).
 * 3. Calculates total transaction value server-side: totalAmount = quantity * agreedPrice.
 * 4. Enforces the deal status lifecycle state machine:
 *    ACCEPTED -> CONFIRMED -> IN_PROGRESS -> COMPLETED (or CANCELLED).
 * 5. Emits tamper-evident in-app notifications on all deal lifecycle events.
 * 6. Single source of truth: Prisma PostgreSQL. Database errors are mapped to
 *    clean application errors and never silently become in-memory writes.
 */

const { getPrisma } = require('../config/database');
const { getAcceptedOffer } = require('./offerAdapter');
const { createNotification } = require('./notificationService');

// State machine definition
const ALLOWED_TRANSITIONS = {
  ACCEPTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal
  CANCELLED: [], // Terminal
};

function notFound(id) {
  const err = new Error(`Deal not found: ${id}`);
  err.status = 404;
  return err;
}

function conflict(msg) {
  const err = new Error(msg);
  err.status = 409;
  return err;
}

function badRequest(msg) {
  const err = new Error(msg);
  err.status = 400;
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
    const dup = new Error(`Deal with this ${fields} already exists`);
    dup.status = 409;
    return dup;
  }
  if (err && err.code === 'P2025') {
    return notFound(id);
  }
  if (err && err.code === 'P2003') {
    const missing = new Error('Farmer or buyer referenced by the deal does not exist');
    missing.status = 404;
    return missing;
  }
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

/**
 * Validates deal lifecycle state transitions.
 * @param {string} currentStatus
 * @param {string} targetStatus
 */
function validateStatusTransition(currentStatus, targetStatus) {
  const current = (currentStatus || '').toUpperCase();
  const target = (targetStatus || '').toUpperCase();

  if (current === target) {
    throw badRequest(`Deal is already in '${current}' status`);
  }

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    throw badRequest(`Unknown current deal status: '${current}'`);
  }

  if (allowed.length === 0) {
    throw badRequest(`Cannot modify deal in terminal status '${current}'`);
  }

  if (!allowed.includes(target)) {
    throw badRequest(
      `Invalid status transition from '${current}' to '${target}'. Allowed transitions from '${current}' are: ${allowed.join(', ')}`
    );
  }

  return target;
}

/**
 * Creates a binding Deal from an accepted B2 offer.
 * @param {Object} input
 * @param {string} input.offerId
 * @param {string} [input.pickupLocation]
 * @param {string} [input.deliveryLocation]
 * @param {Object} [actorUser] - Authenticated user context
 */
async function createDeal(input, actorUser = null) {
  const { offerId, pickupLocation = null, deliveryLocation = null } = input;

  if (!offerId || typeof offerId !== 'string') {
    throw badRequest('offerId is required');
  }

  const cleanOfferId = offerId.trim();
  const prisma = clientOrThrow();

  // 1. Check duplicate deal protection
  const existing = await prisma.deal.findUnique({ where: { offerId: cleanOfferId } });
  if (existing) {
    throw conflict(`Deal already exists for offer: ${cleanOfferId} (Deal ID: ${existing.id})`);
  }

  // 2. Fetch and validate accepted offer from B2 adapter
  const offer = await getAcceptedOffer(cleanOfferId);

  // 3. Server-side transaction calculation (never trust client)
  const quantity = Number(offer.quantity);
  const agreedPrice = Number(offer.agreedPrice);
  if (isNaN(quantity) || quantity <= 0) {
    throw badRequest(`Invalid quantity in accepted offer: ${offer.quantity}`);
  }
  if (isNaN(agreedPrice) || agreedPrice <= 0) {
    throw badRequest(`Invalid agreed price in accepted offer: ${offer.agreedPrice}`);
  }

  const totalAmount = Math.round(quantity * agreedPrice * 100) / 100;

  const dealData = {
    offerId: cleanOfferId,
    farmerId: offer.farmerId,
    buyerId: offer.buyerId,
    cropId: offer.cropId || null,
    cropName: offer.cropName || 'Agricultural Produce',
    quantity,
    unit: offer.unit || 'quintal',
    agreedPrice,
    totalAmount,
    pickupLocation: pickupLocation || offer.pickupLocation || null,
    deliveryLocation: deliveryLocation || offer.deliveryLocation || null,
    status: 'ACCEPTED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let createdDeal;
  try {
    createdDeal = await prisma.deal.create({
      data: dealData,
      include: {
        farmer: { select: { id: true, name: true, phone: true, village: true, district: true } },
        buyer: { select: { id: true, name: true, companyName: true, phone: true } },
      },
    });
  } catch (err) {
    throw toApiError(err, undefined);
  }

  // 4. Emit notifications for Buyer and Farmer (non-blocking: must not
  // abort an already-persisted deal, but failures are real errors upstream).
  try {
    await Promise.all([
      createNotification({
        userId: createdDeal.buyerId,
        userRole: 'buyer',
        type: 'DEAL_CREATED',
        title: 'Deal Created & Escrow Initialized',
        message: `Farmer accepted your offer for ${createdDeal.cropName} (${createdDeal.quantity} ${createdDeal.unit} @ ₹${createdDeal.agreedPrice}/${createdDeal.unit}). Total: ₹${createdDeal.totalAmount.toLocaleString('en-IN')}.`,
        dealId: createdDeal.id,
        offerId: cleanOfferId,
      }),
      createNotification({
        userId: createdDeal.farmerId,
        userRole: 'farmer',
        type: 'DEAL_CREATED',
        title: 'Deal Created with Buyer',
        message: `Binding deal created for ${createdDeal.cropName} (${createdDeal.quantity} ${createdDeal.unit}). Total value: ₹${createdDeal.totalAmount.toLocaleString('en-IN')}.`,
        dealId: createdDeal.id,
        offerId: cleanOfferId,
      }),
    ]);
  } catch {
    // Notification error must not abort successful deal creation
  }

  return createdDeal;
}

/**
 * Retrieves a deal by ID with relational participant details.
 * @param {string} id
 */
async function getDealById(id) {
  if (!id) throw notFound(id);

  const prisma = clientOrThrow();
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true, district: true, state: true } },
      buyer: { select: { id: true, name: true, companyName: true, phone: true, district: true, state: true } },
    },
  });
  if (!deal) throw notFound(id);
  return deal;
}

/**
 * Updates a deal status with state-machine transition validation.
 * @param {string} id
 * @param {string} nextStatus
 * @param {Object} [actorUser]
 */
async function updateDealStatus(id, nextStatus, actorUser = null) {
  const deal = await getDealById(id);
  const validatedStatus = validateStatusTransition(deal.status, nextStatus);

  const now = new Date();
  const updateData = {
    status: validatedStatus,
    updatedAt: now,
  };

  if (validatedStatus === 'COMPLETED') {
    updateData.completedAt = now;
  }

  const prisma = clientOrThrow();
  let updatedDeal;
  try {
    updatedDeal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        farmer: { select: { id: true, name: true, phone: true } },
        buyer: { select: { id: true, name: true, companyName: true, phone: true } },
      },
    });
  } catch (err) {
    throw toApiError(err, id);
  }

  // Emit event notifications
  try {
    const statusTitles = {
      CONFIRMED: 'Deal Confirmed by Counterparty',
      IN_PROGRESS: 'Deal in Progress — Logistics Active',
      COMPLETED: 'Deal Completed & Escrow Settled',
    };

    const title = statusTitles[validatedStatus] || `Deal Status Changed to ${validatedStatus}`;
    const msg = `Deal ${id} for ${updatedDeal.cropName} is now ${validatedStatus}.`;

    await Promise.all([
      createNotification({
        userId: updatedDeal.buyerId,
        userRole: 'buyer',
        type: `DEAL_${validatedStatus}`,
        title,
        message: msg,
        dealId: id,
      }),
      createNotification({
        userId: updatedDeal.farmerId,
        userRole: 'farmer',
        type: `DEAL_${validatedStatus}`,
        title,
        message: msg,
        dealId: id,
      }),
    ]);
  } catch {
    // Non-blocking
  }

  return updatedDeal;
}

/**
 * Cancels a deal with safe state transition.
 * @param {string} id
 * @param {string} [reason]
 * @param {Object} [actorUser]
 */
async function cancelDeal(id, reason = null, actorUser = null) {
  const deal = await getDealById(id);
  validateStatusTransition(deal.status, 'CANCELLED');

  const now = new Date();
  const updateData = {
    status: 'CANCELLED',
    cancelledAt: now,
    cancellationReason: reason || 'Cancelled by participant',
    updatedAt: now,
  };

  const prisma = clientOrThrow();
  let cancelledDeal;
  try {
    cancelledDeal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        farmer: { select: { id: true, name: true, phone: true } },
        buyer: { select: { id: true, name: true, companyName: true, phone: true } },
      },
    });
  } catch (err) {
    throw toApiError(err, id);
  }

  // Emit cancellation notifications
  try {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    await Promise.all([
      createNotification({
        userId: cancelledDeal.buyerId,
        userRole: 'buyer',
        type: 'DEAL_CANCELLED',
        title: 'Deal Cancelled',
        message: `Deal ${id} for ${cancelledDeal.cropName} has been cancelled.${reasonText}`,
        dealId: id,
      }),
      createNotification({
        userId: cancelledDeal.farmerId,
        userRole: 'farmer',
        type: 'DEAL_CANCELLED',
        title: 'Deal Cancelled',
        message: `Deal ${id} for ${cancelledDeal.cropName} has been cancelled.${reasonText}`,
        dealId: id,
      }),
    ]);
  } catch {
    // Non-blocking
  }

  return cancelledDeal;
}

/**
 * Retrieves deals for a farmer with pagination and optional status filter.
 * @param {string} farmerId
 * @param {Object} query
 */
async function getFarmerDeals(farmerId, query = {}) {
  if (!farmerId) throw badRequest('farmerId is required');
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const status = query.status ? query.status.toUpperCase() : undefined;
  const skip = (page - 1) * limit;

  const prisma = clientOrThrow();
  const where = { farmerId };
  if (status) where.status = status;

  const [rows, total] = await prisma.$transaction([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, name: true, companyName: true, phone: true, village: true, district: true } },
      },
    }),
    prisma.deal.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Retrieves deals for a buyer with pagination and optional status filter.
 * @param {string} buyerId
 * @param {Object} query
 */
async function getBuyerDeals(buyerId, query = {}) {
  if (!buyerId) throw badRequest('buyerId is required');
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const status = query.status ? query.status.toUpperCase() : undefined;
  const skip = (page - 1) * limit;

  const prisma = clientOrThrow();
  const where = { buyerId };
  if (status) where.status = status;

  const [rows, total] = await prisma.$transaction([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        farmer: { select: { id: true, name: true, phone: true, village: true, district: true } },
      },
    }),
    prisma.deal.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Lists all deals with optional filters.
 * @param {Object} query
 */
async function getAllDeals(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const status = query.status ? query.status.toUpperCase() : undefined;
  const farmerId = query.farmerId;
  const buyerId = query.buyerId;
  const skip = (page - 1) * limit;

  const prisma = clientOrThrow();
  const where = {};
  if (status) where.status = status;
  if (farmerId) where.farmerId = farmerId;
  if (buyerId) where.buyerId = buyerId;

  const [rows, total] = await prisma.$transaction([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        farmer: { select: { id: true, name: true, phone: true, district: true } },
        buyer: { select: { id: true, name: true, companyName: true, phone: true } },
      },
    }),
    prisma.deal.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data: rows,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Calculates aggregated transaction summary stats for a participant.
 */
async function getDealsSummary({ farmerId, buyerId } = {}) {
  const filter = {};
  if (farmerId) filter.farmerId = farmerId;
  if (buyerId) filter.buyerId = buyerId;

  const allDeals = await getAllDeals({ ...filter, limit: 1000 });
  const deals = allDeals.data;

  const totalDeals = deals.length;
  const completedDeals = deals.filter((d) => d.status === 'COMPLETED').length;
  const activeDeals = deals.filter((d) => ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'].includes(d.status)).length;
  const cancelledDeals = deals.filter((d) => d.status === 'CANCELLED').length;

  const totalVolume = deals.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  const totalValue = deals.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const settledValue = deals
    .filter((d) => d.status === 'COMPLETED')
    .reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

  return {
    totalDeals,
    completedDeals,
    activeDeals,
    cancelledDeals,
    totalVolumeQuintals: Math.round(totalVolume * 100) / 100,
    totalValueRupees: Math.round(totalValue * 100) / 100,
    settledValueRupees: Math.round(settledValue * 100) / 100,
  };
}

module.exports = {
  createDeal,
  getDealById,
  updateDealStatus,
  cancelDeal,
  getFarmerDeals,
  getBuyerDeals,
  getAllDeals,
  getDealsSummary,
  validateStatusTransition,
};
