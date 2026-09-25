// Mandi record normalization (B1 Task 4).
// Pure functions: raw Agmarknet-shaped input -> normalized MarketPrice data.
// Source layout (data.gov.in "Current Daily Price ... (Mandi)", via AGMARKNET):
//   State | District | Market | Commodity | Variety | Grade |
//   Arrival_Date | Min_Price | Max_Price | Modal_Price   (Rs/quintal)
// Variety/Grade are often "Other"/empty; Arrival_Date is DD/MM/YYYY-style;
// prices may carry commas. Lowercase/snake_case keys are accepted too.

function cleanText(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim().replace(/\s+/g, ' ');
  return s === '' ? undefined : s;
}

function lookup(raw, names) {
  if (!raw || typeof raw !== 'object') return undefined;
  const lower = {};
  for (const k of Object.keys(raw)) lower[k.toLowerCase()] = raw[k];
  for (const n of names) {
    if (lower[n] !== undefined && lower[n] !== null && String(lower[n]).trim() !== '') {
      return lower[n];
    }
  }
  return undefined;
}

function parsePrice(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/[₹,\s]/g, '').replace(/rs\.?/gi, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

// Agmarknet arrival dates: DD/MM/YYYY (also tolerates DD-MM-YYYY,
// YYYY-MM-DD, ISO). Returns a UTC-midnight Date (date-only semantics).
function parseObservedDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // DD/MM/YYYY or DD-MM-YYYY
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // YYYY-MM-DD(+time)
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function normalizeUnit(value) {
  const s = cleanText(value);
  if (!s) return 'quintal'; // Agmarknet modal prices are quoted per quintal
  const t = s.toLowerCase();
  if (/(quintal|^qtl$|\bq\b)/.test(t)) return 'quintal';
  if (/(^kg$|per kg|\/kg)/.test(t)) return 'kg';
  if (/tonne|metric|^\bmt\b/.test(t)) return 'tonne';
  return s;
}

const REQUIRED_FIELDS = ['commodity', 'market', 'state'];

// Normalize one raw record. Returns { ok: true, record } or
// { ok: false, errors: [...] }. Never throws on bad data.
function normalizeRecord(raw, source = 'agmarknet') {
  const errors = [];
  const commodity = cleanText(lookup(raw, ['commodity']));
  const market = cleanText(lookup(raw, ['market', 'mandi']));
  const state = cleanText(lookup(raw, ['state']));
  for (const [label, val] of [
    ['commodity', commodity],
    ['market', market],
    ['state', state],
  ]) {
    if (!val) errors.push(`${label} is required`);
  }

  const minPrice = parsePrice(lookup(raw, ['min_price', 'minprice', 'minimum_price']));
  const maxPrice = parsePrice(lookup(raw, ['max_price', 'maxprice', 'maximum_price']));
  const modalRaw = lookup(raw, ['modal_price', 'modalprice', 'model_price']);
  const modalPrice = modalRaw === undefined ? undefined : parsePrice(modalRaw);
  if (minPrice === null) errors.push('minPrice must be a valid number');
  if (maxPrice === null) errors.push('maxPrice must be a valid number');
  if (modalRaw !== undefined && modalPrice === null) errors.push('modalPrice must be a valid number');
  if (minPrice !== null && minPrice < 0) errors.push('minPrice must be >= 0');
  if (maxPrice !== null && maxPrice < 0) errors.push('maxPrice must be >= 0');
  if (modalPrice !== undefined && modalPrice !== null && modalPrice < 0) {
    errors.push('modalPrice must be >= 0');
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    errors.push('minPrice must be <= maxPrice');
  }
  // NOTE: modal outside [min, max] is tolerated — real Agmarknet rows
  // occasionally carry that anomaly; it must not silently drop the record.

  const observedAt = parseObservedDate(lookup(raw, ['arrival_date', 'arrivaldate', 'observedat', 'date']));
  if (!observedAt) errors.push('arrival/observation date must be a valid date');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    record: {
      commodity,
      variety: cleanText(lookup(raw, ['variety'])),
      grade: cleanText(lookup(raw, ['grade'])),
      market,
      district: cleanText(lookup(raw, ['district'])),
      state,
      minPrice,
      maxPrice,
      modalPrice: modalPrice === null ? undefined : modalPrice,
      unit: normalizeUnit(lookup(raw, ['unit', 'unit_name_price'])),
      observedAt,
      source: cleanText(source) || 'agmarknet',
      sourceRecordId: (() => {
        const v = cleanText(lookup(raw, ['sourcerecordid', 'sl_no', 'slno', '_id']));
        return v ? String(v) : undefined;
      })(),
    },
  };
}

// Natural dedup key: same commodity/variety/grade/market/district/state/day/unit.
function dedupKey(n) {
  return [
    n.commodity,
    n.variety || '',
    n.grade || '',
    n.market,
    n.district || '',
    n.state,
    n.observedAt.toISOString(),
    n.unit,
  ]
    .join('|')
    .toLowerCase();
}

module.exports = {
  cleanText,
  parsePrice,
  parseObservedDate,
  normalizeUnit,
  normalizeRecord,
  dedupKey,
  REQUIRED_FIELDS,
};
