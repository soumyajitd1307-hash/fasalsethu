/**
 * Password hashing for first-party credentials.
 *
 * Uses Node's native scrypt — no third-party dependency, because the platform
 * already provides a memory-hard KDF and adding a library would only add
 * supply-chain surface.
 *
 * Design notes:
 * - Every password gets a fresh 16-byte random salt, so two users choosing the
 *   same password never share a digest.
 * - The cost parameters are stored INSIDE each hash, together with a format
 *   version. Verification therefore re-derives with the parameters the hash was
 *   created under, so raising the cost later never invalidates existing
 *   credentials.
 * - Comparison is timing-safe.
 * - Verification NEVER throws and NEVER explains why it failed: a malformed or
 *   truncated stored hash is simply "not a match", so a corrupt row can never
 *   become an oracle or a 500.
 * - Nothing here logs, and no function returns the password.
 */

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

// Explicit, versionable cost parameters. 128 * N * r bytes of memory are used
// per hash: N=32768, r=8 is 32 MiB, which is a sensible server-side trade-off
// between resistance and latency. maxmem is raised because Node's 32 MiB
// default leaves no headroom for exactly this cost.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

// Bumped only if the encoding itself changes meaning. The cost parameters
// travel with each hash, so raising SCRYPT_N does NOT need a version bump.
const FORMAT = 'scrypt';
const FORMAT_VERSION = 'v1';

// Bounds an attacker-supplied string so a huge body cannot turn one login into
// a memory/CPU problem. Comfortably above any real password.
const MIN_PASSWORD_LENGTH = 1;
const MAX_PASSWORD_LENGTH = 1024;

/**
 * @param {string} password
 * @returns {Promise<string>} `scrypt$v1$<N>$<r>$<p>$<saltB64url>$<hashB64url>`
 */
async function hashPassword(password) {
  assertUsablePassword(password);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH);
  return [
    FORMAT,
    FORMAT_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Constant-time verification of a password against a stored hash.
 *
 * @returns {Promise<boolean>} true only on a correct password. Any malformed,
 *   truncated or foreign-format hash returns false.
 */
async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  if (typeof encodedHash !== 'string' || !encodedHash) return false;

  const parts = encodedHash.split('$');
  if (parts.length !== 7) return false;

  const [format, version, rawN, rawR, rawP, saltB64, hashB64] = parts;
  if (format !== FORMAT || version !== FORMAT_VERSION) return false;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!isSafePositiveInt(N) || !isSafePositiveInt(r) || !isSafePositiveInt(p)) return false;

  // Reject absurd cost parameters from a tampered row instead of trying to
  // allocate them.
  if (N > 1048576 || r > 32 || p > 16) return false;

  // Salt and digest lengths are fixed by the format and must NOT be taken from
  // the stored value: otherwise a truncated row would re-derive a shorter key
  // and compare like-for-like, so a corrupted hash would still authenticate.
  // Changing SALT_LENGTH or KEY_LENGTH therefore requires a FORMAT_VERSION
  // bump, which is what the version field is for.
  let salt;
  let expectedDigest;
  try {
    salt = Buffer.from(saltB64, 'base64url');
    expectedDigest = Buffer.from(hashB64, 'base64url');
  } catch {
    return false;
  }
  if (salt.length !== SALT_LENGTH) return false;
  if (expectedDigest.length !== KEY_LENGTH) return false;

  let actual;
  try {
    actual = await derive(password, salt, N, r, p, KEY_LENGTH);
  } catch {
    return false;
  }
  return crypto.timingSafeEqual(actual, expectedDigest);
}

/**
 * Spends roughly the same time as a real verification without checking
 * anything. Called on the "no such account" path so response timing does not
 * reveal whether an identifier exists.
 *
 * The decoy hash is created once, lazily, and then reused.
 */
let decoyHashPromise = null;
async function burnVerificationTime(password) {
  if (!decoyHashPromise) {
    decoyHashPromise = hashPassword(crypto.randomBytes(24).toString('hex')).catch(() => null);
  }
  const decoy = await decoyHashPromise;
  if (!decoy) return;
  await verifyPassword(typeof password === 'string' ? password : '', decoy);
}

function derive(password, salt, N, r, p, keylen) {
  return scrypt(password.normalize('NFKC'), salt, keylen, {
    N,
    r,
    p,
    maxmem: MAX_MEMORY,
  });
}

function isSafePositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function assertUsablePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('password must be a string');
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new RangeError(`password length must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH}`);
  }
}

module.exports = {
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
};
