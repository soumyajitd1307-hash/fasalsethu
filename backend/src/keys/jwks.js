/**
 * First-party RS256 signing keys and public JWKS.
 *
 * The private key is read only from AUTH_PRIVATE_KEY and only ever exists in
 * memory: it is never logged, never returned by an API, and never written to
 * disk. The only material this module publishes is the PUBLIC JWK, so the
 * verification path stays exactly as strict as before — callers still have to
 * present a token whose RS256 signature checks out against a JWKS document
 * served by a configured trusted issuer.
 *
 * Nothing here generates a key. If configuration is missing or unusable the
 * module fails loudly instead of silently minting an ephemeral key, because an
 * ephemeral production key would invalidate every token on restart and would
 * make the issuer unverifiable.
 *
 * This module provides the signing primitive only. It is not wired to any
 * route: issuing tokens to a caller belongs to the future login service, which
 * must first resolve an AuthAccount.
 */

const nodeCrypto = require('node:crypto');
const jose = require('jose');
const env = require('../config/env');

// The one permitted algorithm. Neither the configuration nor a caller may
// change it, so an HS256 downgrade can never be requested.
const ALG = 'RS256';

// Refuse weak RSA keys: RS256 below 2048 bits is not worth accepting for a
// key that will sign production access tokens.
const MIN_RSA_MODULUS_BITS = 2048;

class SigningKeyError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'SigningKeyError';
    this.status = status;
  }
}

/**
 * Render (and most dotenv/CI tooling) store a multi-line PEM as a single line
 * with escaped newlines. Restore real newlines before importing. The result is
 * never logged or returned.
 */
function normalizePrivateKey(raw) {
  return String(raw)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();
}

function requirePrivateKeyPem() {
  const pem = env.authPrivateKey;
  if (!pem) {
    throw new SigningKeyError('Token signing is not configured (AUTH_PRIVATE_KEY is not set)');
  }
  return normalizePrivateKey(pem);
}

function requireKeyId() {
  const kid = env.authKeyId;
  if (!kid) {
    throw new SigningKeyError('Token signing is not configured (AUTH_KEY_ID is not set)');
  }
  return kid;
}

/**
 * The issuer a first-party token is minted for: the configured canonical
 * issuer, i.e. the deployment's own public origin once the platform has been
 * pointed at it. It is read from configuration only and never hardcoded.
 */
function configuredIssuer() {
  const issuer = env.auth0Issuer;
  if (!issuer) {
    throw new SigningKeyError('Token signing is not configured (AUTH0_ISSUER_BASE_URL is not set)');
  }
  return issuer;
}

function configuredAudience() {
  const audience = env.auth0Audience;
  if (!audience) {
    throw new SigningKeyError('Token signing is not configured (AUTH0_AUDIENCE is not set)');
  }
  return audience;
}

async function buildSigningKey() {
  const kid = requireKeyId();
  const pem = requirePrivateKeyPem();

  let privateKey;
  try {
    // PKCS#8 ("BEGIN PRIVATE KEY") is the expected format; PKCS#1 is also
    // accepted because both are unambiguous RSA private keys.
    privateKey = nodeCrypto.createPrivateKey(pem);
  } catch {
    // The underlying error can echo key material, so it is never surfaced.
    throw new SigningKeyError('AUTH_PRIVATE_KEY is not a readable PEM RSA private key');
  }

  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new SigningKeyError(`AUTH_PRIVATE_KEY must be an RSA private key, got '${privateKey.asymmetricKeyType}'`);
  }

  const details = privateKey.asymmetricKeyDetails;
  if (details && details.modulusLength < MIN_RSA_MODULUS_BITS) {
    throw new SigningKeyError(
      `AUTH_PRIVATE_KEY is too weak: RS256 requires at least ${MIN_RSA_MODULUS_BITS}-bit RSA (got ${details.modulusLength})`
    );
  }

  // Only the PUBLIC half is ever turned into a JWK. Exporting a JWK from the
  // private key object would leak d/p/q/dp/dq/qi into the JWKS document.
  const publicKey = nodeCrypto.createPublicKey(privateKey);
  const { kty, n, e } = await jose.exportJWK(publicKey);

  return {
    privateKey,
    kid,
    // Exactly the public parameters, in a fixed order, with no private fields.
    publicJwk: { kty, use: 'sig', alg: ALG, kid, n, e },
  };
}

// Imported once and cached, so the key is neither re-read nor re-imported on
// every request. A failure is not memoized: if configuration is repaired the
// next call can succeed. Rotating a key means restarting the process (or
// calling resetSigningKeyCache) so the exported kid stays stable per key.
let cachedSigningKey = null;

async function loadSigningKey() {
  if (!cachedSigningKey) {
    cachedSigningKey = buildSigningKey().catch((err) => {
      cachedSigningKey = null;
      throw err;
    });
  }
  return cachedSigningKey;
}

/**
 * Drops the cached key. Used when the configured key changes (rotation) and by
 * tests. Never regenerates key material.
 */
function resetSigningKeyCache() {
  cachedSigningKey = null;
}

/**
 * Public description of the configured signing key. The private key object is
 * deliberately NOT reachable through this module's public surface, so no
 * controller or route can leak it by accident: the only ways to use it are
 * signAccessToken() below and the JWKS document, which exposes the public half.
 */
async function getSigningKeyInfo() {
  const { kid, publicJwk } = await loadSigningKey();
  return { kid, publicJwk: { ...publicJwk } };
}

// Claims the server always controls. A caller may supply anything else
// (sub, role, email, name, ...) but can never move the issuer, audience,
// algorithm, key id or validity window.
const RESERVED_CLAIMS = new Set(['iss', 'aud', 'alg', 'kid', 'iat', 'exp', 'nbf']);

/**
 * Mints an RS256 access token for the first-party issuer.
 *
 * The issuer, audience, key id, algorithm and lifetime all come from
 * configuration; a caller that tries to set any of them is rejected outright
 * rather than silently ignored. Refresh tokens are deliberately NOT signed
 * here — they will be opaque random values handled by a later step.
 *
 * @param {object} [claims] additional claims, e.g. { sub, role, email, name }
 * @returns {Promise<string>} a signed JWS
 */
async function signAccessToken(claims = {}) {
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) {
    throw new SigningKeyError('signAccessToken expects an object of claims', 500);
  }
  // JSON.parse materialises "__proto__" as an OWN property, so a plain
  // typeof/Array check would let it through and copy a nested object into the
  // payload. It cannot override a claim (the server sets those afterwards as
  // own properties), but a token must never carry a prototype-manipulating
  // key, so it is rejected rather than sanitised.
  if (Object.prototype.hasOwnProperty.call(claims, '__proto__')) {
    throw new SigningKeyError("signAccessToken: '__proto__' is not an allowed claim", 500);
  }
  for (const claim of Object.keys(claims)) {
    if (RESERVED_CLAIMS.has(claim)) {
      throw new SigningKeyError(
        `signAccessToken: '${claim}' is set by the server and cannot be supplied by the caller`,
        500
      );
    }
  }

  const { privateKey, kid } = await loadSigningKey();
  const issuedAt = Math.floor(Date.now() / 1000);
  const ttl = env.accessTokenTtlSeconds;

  return new jose.SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG, kid, typ: 'JWT' })
    .setIssuer(configuredIssuer())
    .setAudience(configuredAudience())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttl)
    .sign(privateKey);
}

/**
 * The public JWKS document. Returns a fresh object each call so a consumer
 * cannot mutate the cached key material, and never includes private parameters.
 */
async function publicJwks() {
  const { publicJwk } = await loadSigningKey();
  return { keys: [{ ...publicJwk }] };
}

module.exports = {
  ALG,
  MIN_RSA_MODULUS_BITS,
  SigningKeyError,
  configuredIssuer,
  configuredAudience,
  getSigningKeyInfo,
  resetSigningKeyCache,
  publicJwks,
  signAccessToken,
  // Exported for tests of the PEM normalization rule.
  normalizePrivateKey,
};
