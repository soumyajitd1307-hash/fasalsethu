// Market-price query service (B1 Task 4).
// Application-friendly reads over market_prices. Never returns the whole
// dataset: every operation is filtered and/or paginated. mandi prices are
// MARKET CONTEXT — the farmer's crop-listing range stays independent.
const { getPrisma } = require('../config/database');

function dbNotConfigured() {
  const err = new Error('Database not configured (DATABASE_URL is not set)');
  err.status = 503;
  return err;
}

function clientOrThrow() {
  const prisma = getPrisma();
  if (!prisma) throw dbNotConfigured();
  return prisma;
}

function insensitiveContains(value) {
  return value === undefined ? undefined : { contains: value, mode: 'insensitive' };
}

function dayBounds(date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

function buildWhere({ commodity, variety, state, district, market, date, dateFrom, dateTo }) {
  const where = {};
  if (commodity !== undefined) where.commodity = insensitiveContains(commodity);
  if (variety !== undefined) where.variety = insensitiveContains(variety);
  if (state !== undefined) where.state = insensitiveContains(state);
  if (district !== undefined) where.district = insensitiveContains(district);
  if (market !== undefined) where.market = insensitiveContains(market);
  if (date !== undefined) {
    where.observedAt = dayBounds(date);
  } else if (dateFrom !== undefined || dateTo !== undefined) {
    where.observedAt = {};
    if (dateFrom !== undefined) where.observedAt.gte = dateFrom;
    if (dateTo !== undefined) where.observedAt.lte = dateTo;
  }
  return where;
}

async function listMarketPrices(filters) {
  const prisma = clientOrThrow();
  const { page, limit } = filters;
  const where = buildWhere(filters);
  const skip = (page - 1) * limit;
  const [rows, total] = await prisma.$transaction([
    prisma.marketPrice.findMany({ where, skip, take: limit, orderBy: { observedAt: 'desc' } }),
    prisma.marketPrice.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { data: rows, pagination: { page, limit, total, totalPages } };
}

// Latest market context for a commodity (+ optional location):
// newest observation date matching the filters, the rows on that date,
// and a min/modal/max summary. Used by the future price-context UI.
async function getMarketContext({ commodity, state, district, market, limit }) {
  const prisma = clientOrThrow();
  const where = buildWhere({ commodity, state, district, market });
  const newest = await prisma.marketPrice.findFirst({ where, orderBy: { observedAt: 'desc' } });
  if (!newest) {
    const err = new Error('No market prices found for the requested crop/location');
    err.status = 404;
    throw err;
  }
  const records = await prisma.marketPrice.findMany({
    where: { ...where, observedAt: dayBounds(newest.observedAt) },
    orderBy: { market: 'asc' },
    take: limit,
  });
  const modals = records.map((r) => r.modalPrice).filter((v) => typeof v === 'number');
  return {
    filters: { commodity, state, district, market },
    context: {
      latestObservedAt: newest.observedAt,
      markets: new Set(records.map((r) => r.market)).size,
      observations: records.length,
      minOfMinPrice: Math.min(...records.map((r) => r.minPrice)),
      maxOfMaxPrice: Math.max(...records.map((r) => r.maxPrice)),
      avgModalPrice:
        modals.length === 0 ? null : Math.round((modals.reduce((a, b) => a + b, 0) / modals.length) * 100) / 100,
    },
    records,
  };
}

module.exports = { listMarketPrices, getMarketContext };
