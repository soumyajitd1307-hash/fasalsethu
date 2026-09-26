/**
 * Rate limiting for the authentication endpoints.
 *
 * SCOPE AND LIMITS
 * Two independent limiters, keyed separately, with separate budgets:
 *
 *  - credential endpoints (login, register): the outer layer against
 *    credential stuffing and enumeration across many accounts. It is
 *    deliberately NOT the precise control — per-account lockout in
 *    authService is — because a single shared IP cannot distinguish an honest
 *    user from an attacker probing other people's identifiers.
 *  - token endpoints (refresh, logout): a higher budget, because these are
 *    machine-driven and legitimately frequent (a client refreshing an hourly
 *    access token uses ~4 requests per 15-minute window). A tight limit here
 *    would break normal operation, so the budget is generous and exists only
 *    to stop runaway retry loops.
 *
 * Separate counters matter: with one shared budget, a client hammering /refresh
 * could exhaust the allowance and lock a legitimate user out of /login.
 *
 * RATE-LIMIT KEY
 * The resolved client address (`req.ip`), which depends on the `trust proxy`
 * setting configured in config/env.js. The key is intentionally NOT derived
 * from the request body: keying login on the submitted identifier would let an
 * attacker who knows someone's email or Kisan ID lock that account out by
 * exhausting its budget, turning the limiter into a denial-of-service tool.
 * Keying on the address means the cost of an attack is borne by the attacker.
 *
 * The limiter runs BEFORE body validation, so a flood of malformed payloads is
 * throttled too rather than reaching the handler.
 *
 * SCOPE OF THIS LIMITER
 * Process-local, in-memory counters held by this Node process:
 *  - counters RESET when the instance restarts or redeploys;
 *  - counters are NOT shared between instances, so if the service is ever scaled
 *    horizontally the effective limit becomes the per-instance limit multiplied
 *    by the instance count.
 * That is acceptable for the current single Render service. A distributed
 * limiter (Redis) would be required before scaling out; there is no such
 * facility in the current architecture, so none was invented here.
 *
 * RESPONSES
 * A limited request is turned into the same error shape the rest of the API
 * uses, via the existing errorHandler, and carries a Retry-After header. The
 * message is intentionally identical for every endpoint and every reason, so a
 * 429 reveals nothing about whether an identifier or token exists.
 */

const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

const WINDOW_MS = env.rateLimitWindowMs;

/** One message for every limited request, whatever the endpoint or reason. */
const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';

/**
 * Shared 429 behaviour. The error is passed to next() rather than written
 * directly, so the response is produced by the project's own errorHandler and
 * stays consistent with every other error the API returns.
 */
function limitHandler(req, res, next) {
  const retryAfterSeconds = Math.max(1, Math.ceil(WINDOW_MS / 1000));
  res.set('Retry-After', String(retryAfterSeconds));

  const err = new Error(RATE_LIMIT_MESSAGE);
  err.status = 429;
  // Surfaced for observability without ever echoing the key or the body.
  err.rateLimited = true;
  return next(err);
}

/**
 * Builds one limiter. Counters are held per key in this process's memory.
 *
 * `standardHeaders: 'draft-7'` emits RateLimit-Limit/Remaining/Reset and
 * RateLimit-Policy; Retry-After is set explicitly above so it is present
 * regardless of header-draft behaviour.
 */
function buildLimiter({ max, name }) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limitHandler,
    // A stable, non-identifying limiter name for the RateLimit-Policy header.
    // It must never contain the key or any request data.
    keyGenerator: (req) => req.ip,
    // Nothing about the request body is read, stored or keyed on.
    requestPropertyName: `${name}RateLimit`,
  });
}

// Separate limiter instances => separate Maps => independent budgets.
const credentialLimiter = buildLimiter({ max: env.credentialRateLimitMax, name: 'credential' });
const tokenLimiter = buildLimiter({ max: env.tokenRateLimitMax, name: 'token' });

module.exports = {
  RATE_LIMIT_MESSAGE,
  credentialLimiter,
  tokenLimiter,
  // Exported so tests can assert the configured budgets.
  limits: {
    windowMs: WINDOW_MS,
    credentialMax: env.credentialRateLimitMax,
    tokenMax: env.tokenRateLimitMax,
  },
};
