/**
 * Login identifier normalization unit tests. No database required.
 *
 * Type detection is role-scoped: a GSTIN only identifies a buyer and a Kisan ID
 * only identifies a farmer, matching the Prisma schema.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { detectIdentifierType, normalizeIdentifier, profileIdentifiers } = require('../src/auth/identifier');

const FARMER = 'farmer';
const BUYER = 'buyer';

describe('identifier type detection', () => {
  test('classifies the identifier types the schema actually supports', () => {
    assert.equal(detectIdentifierType('farmer@example.com', FARMER), 'email');
    assert.equal(detectIdentifierType('+91 98765 43210', FARMER), 'phone');
    assert.equal(detectIdentifierType('9876543210', FARMER), 'phone');
    assert.equal(detectIdentifierType('KISAN-2024-0001', FARMER), 'kisanId');
    assert.equal(detectIdentifierType('27ABCDE1234F1Z5', BUYER), 'gstin');
  });

  test('a 15-character alphanumeric value is a GSTIN for a buyer', () => {
    assert.equal(detectIdentifierType('27ABCDE1234F1Z5', BUYER), 'gstin');
    assert.equal(detectIdentifierType('27 abcde1234f1z5', BUYER), 'gstin');
  });

  test('a 15-character alphanumeric value stays a Kisan ID for a farmer', () => {
    // The ambiguity is resolved by the role, so a farmer Kisan ID of exactly 15
    // alphanumerics is never mistaken for a GSTIN (and keeps its case).
    assert.equal(detectIdentifierType('KisanId20240001', FARMER), 'kisanId');
    assert.equal(normalizeIdentifier('KisanId20240001', FARMER), 'KisanId20240001');
    assert.equal(normalizeIdentifier('kisanid20240001', FARMER), 'kisanid20240001');
  });

  test('email and phone are detected the same way for both roles', () => {
    for (const role of [FARMER, BUYER]) {
      assert.equal(detectIdentifierType('someone@example.com', role), 'email');
      assert.equal(detectIdentifierType('+91 98765 43210', role), 'phone');
    }
  });
});

describe('identifier normalization', () => {
  test('trims surrounding whitespace for every type', () => {
    assert.equal(normalizeIdentifier('  farmer@example.com  ', FARMER), 'farmer@example.com');
    assert.equal(normalizeIdentifier('  +91 98765 43210 ', FARMER), '+919876543210');
    assert.equal(normalizeIdentifier('\t27abcde1234f1z5\n', BUYER), '27ABCDE1234F1Z5');
    assert.equal(normalizeIdentifier('  KISAN-2024-0001 ', FARMER), 'KISAN-2024-0001');
  });

  test('emails are lowercased', () => {
    assert.equal(normalizeIdentifier('Farmer@Example.COM', FARMER), 'farmer@example.com');
    assert.equal(normalizeIdentifier('Buyer@Example.COM', BUYER), 'buyer@example.com');
  });

  test('phone numbers keep their digits and an explicit country code', () => {
    assert.equal(normalizeIdentifier('+91 98765 43210', FARMER), '+919876543210');
    assert.equal(normalizeIdentifier('+91-98765-43210', FARMER), '+919876543210');
    assert.equal(normalizeIdentifier('(98765) 43210', FARMER), '9876543210');
    assert.equal(normalizeIdentifier('98765.43210', FARMER), '9876543210');
    // Presentation-only differences of the SAME number must agree.
    assert.equal(normalizeIdentifier('+91 98765 43210', FARMER), normalizeIdentifier('+919876543210', FARMER));
    assert.equal(normalizeIdentifier('98765 43210', FARMER), normalizeIdentifier('9876543210', FARMER));
  });

  test('a country code is never guessed, so distinct numbers stay distinct', () => {
    // Stripping a prefix would merge two different subscribers.
    assert.notEqual(normalizeIdentifier('+919876543210', FARMER), normalizeIdentifier('09876543210', FARMER));
    assert.notEqual(normalizeIdentifier('+14155552671', FARMER), normalizeIdentifier('4155552671', FARMER));
  });

  test('GSTINs are uppercased into their canonical form', () => {
    assert.equal(normalizeIdentifier('27abcde1234f1z5', BUYER), '27ABCDE1234F1Z5');
    assert.equal(normalizeIdentifier('27 abcde1234f1z5', BUYER), '27ABCDE1234F1Z5');
  });

  test('a Kisan ID keeps its case, so case-distinct IDs stay distinct', () => {
    assert.equal(normalizeIdentifier('Kisan-2024-0001', FARMER), 'Kisan-2024-0001');
    assert.equal(normalizeIdentifier('kisan 2024 0001', FARMER), 'kisan 2024 0001');
    assert.notEqual(normalizeIdentifier('Kisan-2024-0001', FARMER), normalizeIdentifier('kisan-2024-0001', FARMER));
  });

  test('normalization is deterministic and idempotent', () => {
    const cases = [
      [' Farmer@Example.com ', FARMER],
      ['+91 98765 43210', FARMER],
      ['27abcde1234f1z5', BUYER],
      ['Kisan-2024-0001', FARMER],
    ];
    for (const [raw, role] of cases) {
      const once = normalizeIdentifier(raw, role);
      assert.equal(normalizeIdentifier(once, role), once, `must be idempotent for ${raw}`);
      assert.equal(normalizeIdentifier(raw, role), once, `must be deterministic for ${raw}`);
    }
  });

  test('empty or non-string input normalizes to an empty string', () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      assert.equal(normalizeIdentifier(bad, FARMER), '');
      assert.equal(normalizeIdentifier(bad, BUYER), '');
    }
  });

  test('normalization never merges identifiers of different types', () => {
    const normalized = [
      normalizeIdentifier('farmer@example.com', FARMER),
      normalizeIdentifier('+91 98765 43210', FARMER),
      normalizeIdentifier('27ABCDE1234F1Z5', BUYER),
      normalizeIdentifier('Kisan-2024-0001', FARMER),
    ];
    assert.equal(new Set(normalized).size, normalized.length, 'all four must remain distinct');
  });
});

describe('profile identifiers', () => {
  test('a farmer profile exposes email, phone and Kisan ID', () => {
    const farmer = { email: 'F@Example.com', phone: '+91 98765 43210', kisanId: 'KISAN-1', gstin: '27ABCDE1234F1Z5' };
    const ids = profileIdentifiers(farmer, FARMER);
    assert.deepEqual(ids.sort(), ['+919876543210', 'KISAN-1', 'f@example.com']);
    // A GSTIN is irrelevant for a farmer and must not be reachable.
    assert.ok(!ids.includes('27ABCDE1234F1Z5'));
  });

  test('a buyer profile exposes email, phone and GSTIN', () => {
    const buyer = { email: 'B@Example.com', phone: '+91 98765 43211', gstin: '27abcde1234f1z5', kisanId: 'KISAN-1' };
    const ids = profileIdentifiers(buyer, BUYER);
    assert.deepEqual(ids.sort(), ['+919876543211', '27ABCDE1234F1Z5', 'b@example.com']);
    assert.ok(!ids.includes('KISAN-1'));
  });

  test('a profile with no identifiers yields an empty list', () => {
    assert.deepEqual(profileIdentifiers({ email: null, phone: '   ', kisanId: null }, FARMER), []);
    assert.deepEqual(profileIdentifiers(null, FARMER), []);
  });
});
