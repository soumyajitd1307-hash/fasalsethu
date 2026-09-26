// Mandi ingestion / import pipeline (B1 Task 4).
//   raw Agmarknet-shaped rows -> validate -> normalize -> dedupe ->
//   batched DB upsert -> market_prices  (+ stats, never silent drops)
const { getPrisma } = require('../config/database');
const { normalizeRecord, dedupKey } = require('../utils/marketPriceNormalize');

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

// Minimal CSV parser (no new dependencies): handles quoted fields,
// embedded commas, CRLF. Returns row objects keyed by the header row.
function parseCsvText(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const src = String(text || '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip; \n handles the break
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => String(h).trim());
  return nonEmpty.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });
}

function samePrices(a, b) {
  return a.minPrice === b.minPrice && a.maxPrice === b.maxPrice && (a.modalPrice || null) === (b.modalPrice || null);
}

function exactWhere(n) {
  const where = {
    commodity: n.commodity,
    market: n.market,
    state: n.state,
    observedAt: n.observedAt,
    unit: n.unit,
  };
  if (n.variety === undefined) where.variety = null;
  else where.variety = n.variety;
  if (n.grade === undefined) where.grade = null;
  else where.grade = n.grade;
  if (n.district === undefined) where.district = null;
  else where.district = n.district;
  return where;
}

// Import raw rows in chunks (bounded memory). Returns
// { total, valid, invalid, inserted, updated, duplicates, errors[] }
// where errors holds up to 25 samples of { index, errors }.
async function importRecords(rawRecords, options = {}) {
  const prisma = clientOrThrow();
  const { source = 'agmarknet', chunkSize = 500, maxErrorSamples = 25 } = options;
  const list = Array.isArray(rawRecords) ? rawRecords : [];
  const stats = { total: list.length, valid: 0, invalid: 0, inserted: 0, updated: 0, duplicates: 0, errors: [] };

  for (let start = 0; start < list.length; start += chunkSize) {
    const chunk = list.slice(start, start + chunkSize);
    const seen = new Map(); // dedupKey -> normalized (first wins, rest = duplicates)
    chunk.forEach((raw, offset) => {
      const index = start + offset;
      const result = normalizeRecord(raw, source);
      if (!result.ok) {
        stats.invalid += 1;
        if (stats.errors.length < maxErrorSamples) stats.errors.push({ index, errors: result.errors });
        return;
      }
      stats.valid += 1;
      const key = dedupKey(result.record);
      // Within a file, the LAST row wins (later rows are corrections of
      // earlier ones); the replaced occurrence counts as a duplicate.
      if (seen.has(key)) stats.duplicates += 1;
      seen.set(key, result.record);
    });
    if (seen.size === 0) continue;

    const uniques = [...seen.values()];
    const existing = await prisma.marketPrice.findMany({
      where: { OR: uniques.map(exactWhere) },
    });
    const byKey = new Map(existing.map((r) => [dedupKey(r), r]));

    for (const record of uniques) {
      const key = dedupKey(record);
      const prev = byKey.get(key);
      if (!prev) {
        await prisma.marketPrice.create({ data: record });
        stats.inserted += 1;
      } else if (!samePrices(prev, record)) {
        await prisma.marketPrice.update({
          where: { id: prev.id },
          data: {
            minPrice: record.minPrice,
            maxPrice: record.maxPrice,
            modalPrice: record.modalPrice,
            sourceRecordId: record.sourceRecordId,
          },
        });
        stats.updated += 1;
      } else {
        stats.duplicates += 1;
      }
    }
  }
  return stats;
}

module.exports = { parseCsvText, importRecords };
