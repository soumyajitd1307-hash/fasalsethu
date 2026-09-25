// Unit tests: mandi normalization + CSV parsing (no DB, no server, no network).
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const norm = require('../src/utils/marketPriceNormalize');
const { parseCsvText } = require('../src/services/marketPriceIngestService');

const ROW = {
  State: 'Maharashtra', District: 'Nashik', Market: 'Lasalgaon', Commodity: 'Onion',
  Variety: 'Red', Grade: 'FAQ', Arrival_Date: '01/02/2024',
  Min_Price: '1,200', Max_Price: '1,500', Modal_Price: '1350',
};

describe('text / price helpers', () => {
  test('cleanText trims, collapses spaces, empties to undefined', () => {
    assert.equal(norm.cleanText('  Lasal   Gaon '), 'Lasal Gaon');
    assert.equal(norm.cleanText('   '), undefined);
    assert.equal(norm.cleanText(null), undefined);
  });

  test('parsePrice strips commas and currency prefixes', () => {
    assert.equal(norm.parsePrice('1,280'), 1280);
    assert.equal(norm.parsePrice('₹1,280'), 1280);
    assert.equal(norm.parsePrice('Rs. 1280'), 1280);
    assert.equal(norm.parsePrice(42), 42);
    assert.equal(norm.parsePrice('high'), null);
    assert.equal(norm.parsePrice(''), null);
  });
});

describe('date parsing', () => {
  test('DD/MM/YYYY equals ISO YYYY-MM-DD (UTC midnight)', () => {
    const a = norm.parseObservedDate('01/02/2024');
    const b = norm.parseObservedDate('2024-02-01');
    assert.ok(a instanceof Date && b instanceof Date);
    assert.equal(a.getTime(), b.getTime());
    assert.equal(a.toISOString(), '2024-02-01T00:00:00.000Z');
  });

  test('rejects garbage and empty dates', () => {
    assert.equal(norm.parseObservedDate('not-a-date'), null);
    assert.equal(norm.parseObservedDate(''), null);
    assert.equal(norm.parseObservedDate(null), null);
  });
});

describe('unit normalization', () => {
  test('maps quintal/kg/tonne variants, defaults missing to quintal', () => {
    assert.equal(norm.normalizeUnit(undefined), 'quintal');
    assert.equal(norm.normalizeUnit('Rs./Quintal'), 'quintal');
    assert.equal(norm.normalizeUnit('QTL'), 'quintal');
    assert.equal(norm.normalizeUnit('Rs./kg'), 'kg');
    assert.equal(norm.normalizeUnit('Metric Tonnes'), 'tonne');
  });
});

describe('normalizeRecord', () => {
  test('normalizes a valid Agmarknet-shaped row', () => {
    const r = norm.normalizeRecord(ROW);
    assert.equal(r.ok, true);
    assert.equal(r.record.commodity, 'Onion');
    assert.equal(r.record.minPrice, 1200);
    assert.equal(r.record.maxPrice, 1500);
    assert.equal(r.record.modalPrice, 1350);
    assert.equal(r.record.unit, 'quintal');
    assert.equal(r.record.source, 'agmarknet');
    assert.equal(r.record.observedAt.toISOString().slice(0, 10), '2024-02-01');
  });

  test('accepts lowercase keys too', () => {
    const r = norm.normalizeRecord({
      state: 'MH', district: 'D', market: 'M', commodity: 'Wheat',
      arrival_date: '2024-01-05', min_price: 1, max_price: 2,
    });
    assert.equal(r.ok, true);
    assert.equal(r.record.commodity, 'Wheat');
  });

  test('missing required fields fail with clear errors', () => {
    const r = norm.normalizeRecord({ State: 'MH', Market: 'M', Min_Price: 1, Max_Price: 2, Arrival_Date: '01/01/2024' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('commodity')));
  });

  test('rejects invalid / negative / inverted prices', () => {
    assert.equal(norm.normalizeRecord({ ...ROW, Min_Price: 'high' }).ok, false);
    assert.equal(norm.normalizeRecord({ ...ROW, Min_Price: -5 }).ok, false);
    assert.equal(norm.normalizeRecord({ ...ROW, Min_Price: 9, Max_Price: 2 }).ok, false);
  });

  test('missing optional variety/grade/modal is fine', () => {
    const { Variety, Grade, Modal_Price, ...rest } = ROW;
    void Variety; void Grade; void Modal_Price;
    const r = norm.normalizeRecord(rest);
    assert.equal(r.ok, true);
    assert.equal(r.record.variety, undefined);
    assert.equal(r.record.grade, undefined);
    assert.equal(r.record.modalPrice, undefined);
  });

  test('modal outside [min,max] is tolerated (real source anomaly)', () => {
    const r = norm.normalizeRecord({ ...ROW, Modal_Price: 9999 });
    assert.equal(r.ok, true);
    assert.equal(r.record.modalPrice, 9999);
  });

  test('maps source record ids (Sl_No) and custom source names', () => {
    const r = norm.normalizeRecord({ ...ROW, Sl_No: '42' }, 'csv-upload');
    assert.equal(r.ok, true);
    assert.equal(r.record.sourceRecordId, '42');
    assert.equal(r.record.source, 'csv-upload');
  });
});

describe('dedupKey', () => {
  test('equal for case/space variants, different for other days', () => {
    const a = norm.normalizeRecord(ROW).record;
    const b = norm.normalizeRecord({ ...ROW, Commodity: '  onion ', Market: 'LASALGAON' }).record;
    assert.equal(norm.dedupKey(a), norm.dedupKey(b));
    const c = norm.normalizeRecord({ ...ROW, Arrival_Date: '02/02/2024' }).record;
    assert.notEqual(norm.dedupKey(a), norm.dedupKey(c));
  });
});

describe('parseCsvText', () => {
  test('handles quotes, embedded commas, CRLF and blank lines', () => {
    const csv = 'State,Market,Min_Price\r\nMH,"Lasal, Gaon","1,200"\r\n\nMH,Pune,500\r\n';
    const rows = parseCsvText(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].Market, 'Lasal, Gaon');
    assert.equal(rows[0].Min_Price, '1,200');
    assert.equal(rows[1].Market, 'Pune');
  });

  test('returns [] for empty input', () => {
    assert.deepEqual(parseCsvText(''), []);
    assert.deepEqual(parseCsvText('\n\n'), []);
  });
});
