/**
 * Opaque refresh-token primitives.
 *
 * A refresh token is NOT a JWT: it carries no claims, is not signed, and is
 * never parsed. It is 384 bits of CSPRNG output, which is what makes the
 * single-exposure model below safe.
 *
 * Only the SHA-256 digest is ever persisted. A plain (unsalted) hash is
 * deliberate and correct here, unlike for passwords: the input is 384 bits of
 * uniform random data, so there is no dictionary to attack and no rainbow table
 * worth building. Salting would actively break the flow, because the token has
 * to be looked up BY its hash. A database leak therefore yields nothing an
 * attacker can present.
 *
 * Timing-safe comparison is intentionally absent: the token is located by an
 * indexed exact-match lookup, not compared against a secret, and the input
 * space makes brute force infeasible regardless.
 */

const crypto = require('node:crypto');

// 48 bytes = 384 bits, comfortably above every recommendation for bearer
// secrets, and it encodes to a URL-safe string with no padding.
const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_ENCODING = 'base64url';

/**
 * @returns {string} a fresh opaque refresh token. Never logged.
 */
function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString(REFRESH_TOKEN_ENCODING);
}

/**
 * The value stored in RefreshToken.tokenHash.
 *
 * @param {string} token
 * @returns {string} lowercase hex SHA-256 digest
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

/**
 * Groups every token descended from one login, which is what makes reuse of an
 * already-rotated token detectable.
 *
 * @returns {string}
 */
function newFamilyId() {
  return crypto.randomUUID();
}

module.exports = {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_ENCODING,
  generateRefreshToken,
  hashRefreshToken,
  newFamilyId,
};
