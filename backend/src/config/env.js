// Central environment configuration. Never commit real secrets.
const path = require('path');

// Load .env from the backend root (backend/.env) rather than the current
// working directory, so the server, Prisma CLI and nodemon all read the same
// file no matter where the process was started from. A missing .env is not an
// error: real environment variables always win, and the app boots without a DB.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function parseOrigins(value, fallback) {
  const raw = value || fallback;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_AUTH_LOCKOUT_MAX_ATTEMPTS = 5;
const DEFAULT_AUTH_LOCKOUT_DURATION_MINUTES = 15;
const DEFAULT_CREDENTIAL_RATE_LIMIT_MAX = 20;
const DEFAULT_TOKEN_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * Parses the Express `trust proxy` setting.
 *
 * The deployed service sits behind exactly one reverse proxy (Render's edge),
 * which appends the real client address to X-Forwarded-For. Trusting a single
 * hop therefore means Express reads the RIGHTMOST forwarded entry — the one
 * the proxy wrote — so a client cannot spoof its own address by prepending
 * entries of its own. Trusting `true` instead would let any client forge the
 * header outright, which is why it is not the default.
 *
 * Accepts a hop count ("0", "1"), or true/false. Overridable so a deployment
 * behind a different topology is not stuck with the wrong assumption.
 */
function parseTrustProxy(value) {
  const raw = String(value === undefined || value === null || value === '' ? 1 : value).trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`Invalid TRUST_PROXY: "${value}" must be a non-negative integer, true or false`);
  }
  return hops;
}

/**
 * Validates an issuer URL and returns it in canonical form with a trailing
 * slash, so issuer comparison is always exact and never prefix-based.
 * A malformed value throws while this module is being loaded, i.e. at
 * configuration time, instead of being silently accepted and only failing
 * later during token verification.
 */
function normalizeIssuerUrl(value, label = 'issuer') {
  const raw = String(value).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid ${label}: "${raw}" is not an absolute URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid ${label}: "${raw}" must use http or https`);
  }
  // A query string or fragment would make exact issuer matching ambiguous.
  if (parsed.search || parsed.hash) {
    throw new Error(`Invalid ${label}: "${raw}" must not carry a query string or fragment`);
  }
  return parsed.toString().endsWith('/') ? parsed.toString() : `${parsed.toString()}/`;
}

/**
 * Validates an explicitly configured JWKS document URL. Kept separate from
 * normalizeIssuerUrl: a JWKS URL is used verbatim (no trailing slash is
 * forced) and a signed-URL style query string is allowed.
 */
function normalizeJwksUrl(value, label = 'AUTH0_JWKS_URI') {
  const raw = String(value).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid ${label}: "${raw}" is not an absolute URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid ${label}: "${raw}" must use http or https`);
  }
  return parsed.toString();
}

/**
 * Parses AUTH_TRUSTED_ISSUERS into a deduplicated list of canonical issuer
 * URLs. Whitespace is trimmed, empty entries are dropped, and a malformed
 * entry aborts configuration rather than being ignored.
 */
function parseTrustedIssuers(value) {
  if (value === undefined || value === null) return [];
  const entries = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const issuers = [];
  for (const entry of entries) {
    const normalized = normalizeIssuerUrl(entry, 'AUTH_TRUSTED_ISSUERS entry');
    if (!issuers.includes(normalized)) issuers.push(normalized);
  }
  return issuers;
}

function positiveInt(value, fallback, label) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: "${value}" must be a positive integer`);
  }
  return parsed;
}

function optional(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return String(value);
}

// Browser origins that are always permitted to call this API.
//
// CORS_ORIGIN *adds* to this list rather than replacing it, so a deployment
// cannot lock out the published frontend by setting only a local origin.
//
// The GitHub Pages entry is deliberately the bare scheme+host. The site is
// served from https://<owner>.github.io/<repo>/, but a browser sends only
// scheme+host+port in the Origin header — the /<repo> path is not part of the
// origin, so one entry covers the whole site.
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://soumyajitd1307-hash.github.io',
];

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8000),
  databaseUrl: process.env.DATABASE_URL || null,
  corsOrigins: [
    ...new Set([...DEFAULT_CORS_ORIGINS, ...parseOrigins(process.env.CORS_ORIGIN, '')]),
  ],
  // Auth0 JWT issuer base URL (e.g. https://TENANT.us.auth0.com/). Null when
  // unset — protected routes then fail closed with 503. Never hardcode tenants.
  auth0Issuer: process.env.AUTH0_ISSUER_BASE_URL
    ? normalizeIssuerUrl(process.env.AUTH0_ISSUER_BASE_URL, 'AUTH0_ISSUER_BASE_URL')
    : null,
  auth0Audience: process.env.AUTH0_AUDIENCE || null,
  // Explicit JWKS document URL. Optional: when unset the verifier keeps
  // deriving <AUTH0_ISSUER_BASE_URL>/.well-known/jwks.json. Honoured for the
  // primary issuer only; other trusted issuers always use the derived path.
  auth0JwksUri: process.env.AUTH0_JWKS_URI
    ? normalizeJwksUrl(process.env.AUTH0_JWKS_URI)
    : null,
  // Additional accepted issuers, matched exactly. Empty means "not
  // configured" for this list, and the verifier falls back to the single
  // AUTH0_ISSUER_BASE_URL above.
  authTrustedIssuers: parseTrustedIssuers(process.env.AUTH_TRUSTED_ISSUERS),
  // First-party RS256 signing material, used by src/keys/jwks.js to sign access
  // tokens; only the public half is published at /.well-known/jwks.json. Not
  // required to boot: without it the service starts normally and the JWKS
  // endpoint and token signing fail with a clear 503 rather than falling back
  // to an ephemeral key. Must only ever come from the platform's secret
  // store, never from source control.
  authPrivateKey: optional(process.env.AUTH_PRIVATE_KEY),
  authKeyId: optional(process.env.AUTH_KEY_ID),
  accessTokenTtlSeconds: positiveInt(
    process.env.ACCESS_TOKEN_TTL_SECONDS,
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    'ACCESS_TOKEN_TTL_SECONDS'
  ),
  refreshTokenTtlDays: positiveInt(
    process.env.REFRESH_TOKEN_TTL_DAYS,
    DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    'REFRESH_TOKEN_TTL_DAYS'
  ),
  // Credential lockout policy. Bounded by design: once the threshold is hit the
  // account locks for a fixed window and the counter resets, so a user can
  // never be locked out permanently by an attacker. Neither value is ever
  // exposed to the caller.
  authLockoutMaxAttempts: positiveInt(
    process.env.AUTH_LOCKOUT_MAX_ATTEMPTS,
    DEFAULT_AUTH_LOCKOUT_MAX_ATTEMPTS,
    'AUTH_LOCKOUT_MAX_ATTEMPTS'
  ),
  authLockoutDurationMinutes: positiveInt(
    process.env.AUTH_LOCKOUT_DURATION_MINUTES,
    DEFAULT_AUTH_LOCKOUT_DURATION_MINUTES,
    'AUTH_LOCKOUT_DURATION_MINUTES'
  ),

  // --- Rate limiting (see middleware/rateLimit.js for the rationale) ---
  // Two independent limiters with separate budgets, so a burst of token
  // operations can never consume the credential budget and lock a legitimate
  // user out of signing in.
  credentialRateLimitMax: positiveInt(
    process.env.AUTH_CREDENTIAL_RATE_LIMIT_MAX,
    DEFAULT_CREDENTIAL_RATE_LIMIT_MAX,
    'AUTH_CREDENTIAL_RATE_LIMIT_MAX'
  ),
  tokenRateLimitMax: positiveInt(
    process.env.AUTH_TOKEN_RATE_LIMIT_MAX,
    DEFAULT_TOKEN_RATE_LIMIT_MAX,
    'AUTH_TOKEN_RATE_LIMIT_MAX'
  ),
  rateLimitWindowMs: positiveInt(
    process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
    DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
    'AUTH_RATE_LIMIT_WINDOW_MINUTES'
  ) * 60 * 1000,

  // How many reverse proxies to trust when deriving the client address used as
  // the rate-limit key. See parseTrustProxy above.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // Exported so the verifier and the tests share exactly one set of parsing
  // and validation rules.
  normalizeIssuerUrl,
  normalizeJwksUrl,
  parseTrustedIssuers,
  parseTrustProxy,
};
