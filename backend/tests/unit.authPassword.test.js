/**
 * Password hashing unit tests. No database and no network required.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
  KEY_LENGTH,
  SALT_LENGTH,
  FORMAT,
  FORMAT_VERSION,
  MAX_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
  burnVerificationTime,
} = require('../src/auth/password');

describe('password hashing', () => {
  test('a hash carries its format, version, cost parameters, salt and digest', async () => {
    const encoded = await hashPassword('correct horse battery staple');
    const parts = encoded.split('$');

    assert.equal(parts.length, 7);
    assert.equal(parts[0], FORMAT);
    assert.equal(parts[1], FORMAT_VERSION);
    assert.equal(Number(parts[2]), SCRYPT_N, 'cost N must be recorded');
    assert.equal(Number(parts[3]), SCRYPT_R, 'cost r must be recorded');
    assert.equal(Number(parts[4]), SCRYPT_P, 'cost p must be recorded');
    assert.equal(Buffer.from(parts[5], 'base64url').length, SALT_LENGTH, 'salt must be present');
    assert.equal(Buffer.from(parts[6], 'base64url').length, KEY_LENGTH, 'digest must be present');
  });

  test('the plaintext password never appears in the hash', async () => {
    const password = 'Sup3rSecret!';
    const encoded = await hashPassword(password);
    assert.ok(!encoded.includes(password));
    assert.ok(!encoded.includes(Buffer.from(password).toString('base64')));
    assert.ok(!encoded.includes(password.normalize('NFKC')));
  });

  test('the same password hashes differently every time (per-password salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    assert.notEqual(a, b, 'two hashes of one password must differ');
    // ...and both still verify.
    assert.equal(await verifyPassword('same-password', a), true);
    assert.equal(await verifyPassword('same-password', b), true);
  });

  test('a correct password verifies', async () => {
    const encoded = await hashPassword('a-valid-password');
    assert.equal(await verifyPassword('a-valid-password', encoded), true);
  });

  test('a wrong password does not verify', async () => {
    const encoded = await hashPassword('a-valid-password');
    assert.equal(await verifyPassword('a-valid-passwerd', encoded), false);
    assert.equal(await verifyPassword('A-VALID-PASSWORD', encoded), false);
    assert.equal(await verifyPassword('', encoded), false);
  });

  test('unicode passwords are normalized consistently', async () => {
    // The same typed password must verify whether composed or decomposed.
    const composed = 'pässwörd-é';
    const decomposed = 'pässwörd-é';
    const encoded = await hashPassword(composed);
    assert.equal(await verifyPassword(decomposed, encoded), true);
  });

  test('malformed stored hashes fail safely instead of throwing', async () => {
    const malformed = [
      '',
      'not-a-hash',
      'scrypt',
      'scrypt$v1$32768$8$1',
      'scrypt$v1$32768$8$1$onlysix',
      'scrypt$v1$32768$8$1$c2FsdA$',              // empty digest
      'scrypt$v1$abc$8$1$c2FsdA$aGFzaA',          // non-numeric cost
      'scrypt$v1$0$8$1$c2FsdA$aGFzaA',            // zero cost
      'scrypt$v1$-5$8$1$c2FsdA$aGFzaA',           // negative cost
      'scrypt$v1$99999999$8$1$c2FsdA$aGFzaA',     // absurd cost, must not allocate
      'bcrypt$v1$32768$8$1$c2FsdA$aGFzaa',        // foreign format
      'scrypt$v2$32768$8$1$c2FsdA$aGFzaA',        // unknown version
      'scrypt$v1$32768$8$1$!!!$aGFzaA',           // undecodable salt
      null,
      undefined,
      12345,
      {},
    ];
    for (const stored of malformed) {
      const result = await verifyPassword('a-valid-password', stored);
      assert.equal(result, false, `must fail closed for ${JSON.stringify(stored)}`);
    }
  });

  test('a hash truncated mid-digest does not verify', async () => {
    const encoded = await hashPassword('a-valid-password');
    const parts = encoded.split('$');

    // Shortening the digest must not be able to produce a "matching" hash: the
    // expected length is fixed by the format, not read from the row.
    const shortDigest = parts.slice();
    shortDigest[6] = shortDigest[6].slice(0, shortDigest[6].length - 4);
    assert.equal(await verifyPassword('a-valid-password', shortDigest.join('$')), false);

    // A wrong-but-correctly-sized digest must also fail.
    const swapped = parts.slice();
    swapped[6] = Buffer.alloc(KEY_LENGTH, 7).toString('base64url');
    assert.equal(await verifyPassword('a-valid-password', swapped.join('$')), false);

    // Tampering with the salt must fail too.
    const salted = parts.slice();
    salted[5] = Buffer.alloc(SALT_LENGTH, 9).toString('base64url');
    assert.equal(await verifyPassword('a-valid-password', salted.join('$')), false);
  });

  test('hashPassword rejects input that is not a usable string', async () => {
    await assert.rejects(() => hashPassword(''), RangeError);
    await assert.rejects(() => hashPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1)), RangeError);
    await assert.rejects(() => hashPassword(null), TypeError);
    await assert.rejects(() => hashPassword(12345678), TypeError);
  });

  test('an over-long password never reaches the KDF', async () => {
    // verifyPassword must short-circuit rather than spend 32 MiB on junk.
    const encoded = await hashPassword('a-valid-password');
    assert.equal(await verifyPassword('x'.repeat(MAX_PASSWORD_LENGTH + 1), encoded), false);
  });

  test('burnVerificationTime resolves and never throws', async () => {
    await burnVerificationTime('anything');
    await burnVerificationTime(undefined);
    await assert.doesNotReject(() => burnVerificationTime('x'.repeat(5000)));
  });
});
