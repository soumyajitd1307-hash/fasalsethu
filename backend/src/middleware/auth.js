/**
 * Authentication & Authorization Middleware.
 *
 * Single authentication model: Auth0-style RS256 JWTs verified against a
 * JWKS endpoint. There is deliberately NO fallback to client-controlled
 * identity headers — a request carrying only `x-user-id` is unauthenticated.
 *
 * - `requireAuth`: rejects missing/malformed/invalid tokens with 401.
 *   When Auth0 is not configured (no issuer), it fails closed with 503.
 *   Verified claims are exposed as `req.user = { id, role, email, name }`.
 * - `authorizeDealAccess` / `authorizeDealParticipant`: ownership checks
 *   (authorization, applied after authentication).
 */

const jose = require('jose');
const env = require('../config/env');

class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function authNotConfigured() {
  return new AuthError('Authentication is not configured (AUTH0_ISSUER_BASE_URL is not set)', 503);
}

function withTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

// JWKS client cache, keyed by issuer so tests can point at a local JWKS
// server via environment without a process restart.
let cachedIssuer = null;
let cachedJwks = null;

function jwksForIssuer(issuer) {
  if (cachedJwks && cachedIssuer === issuer) return cachedJwks;
  cachedIssuer = issuer;
  cachedJwks = jose.createRemoteJWKSet(new URL('.well-known/jwks.json', withTrailingSlash(issuer)));
  return cachedJwks;
}

/**
 * Extracts a Bearer token from the Authorization header. Returns null for
 * missing, malformed, or non-Bearer credentials.
 */
function extractToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
    return parts[1];
  }
  return null;
}

/**
 * Cryptographically verifies an RS256 JWT (signature, issuer, audience,
 * expiry/nbf) and returns its claims. Never decodes-without-verifying.
 */
async function verifyToken(token) {
  if (!env.auth0Issuer) throw authNotConfigured();
  const options = { issuer: withTrailingSlash(env.auth0Issuer), algorithms: ['RS256'] };
  if (env.auth0Audience) {
    options.audience = env.auth0Audience;
  }
  const { payload } = await jose.jwtVerify(token, jwksForIssuer(env.auth0Issuer), options);
  return payload;
}

function unauthorized(message) {
  return new AuthError(message || 'Unauthorized: missing or invalid credentials', 401);
}

/**
 * Strict authentication gate for protected routes.
 */
async function requireAuth(req, res, next) {
  try {
    if (!env.auth0Issuer) throw authNotConfigured();
    const token = extractToken(req.headers && req.headers.authorization);
    if (!token) throw unauthorized('Unauthorized: missing or malformed Authorization Bearer token');
    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      // Never leak token material or verifier internals to clients.
      throw unauthorized('Unauthorized: invalid or expired token');
    }
    req.user = {
      id: payload.sub,
      role: (payload.role || 'user').toLowerCase(),
      email: payload.email,
      name: payload.name,
    };
    if (!req.user.id) throw unauthorized('Unauthorized: token carries no subject');
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Ensures user is authorized to access a specific farmer or buyer's deal history.
 * Prevents unauthorized users from viewing another user's transactions.
 */
function authorizeDealAccess(req, res, next) {
  const user = req.user;
  // If unauthenticated and auth is strictly enforced
  if (!user || !user.id) {
    const err = new AuthError('Authentication required to access deal transactions.');
    return next(err);
  }

  const farmerId = req.params.farmerId;
  const buyerId = req.params.buyerId;

  // Farmers can only view their own deals
  if (farmerId && user.role === 'farmer' && user.id !== farmerId) {
    const err = new AuthError(`Access denied: you cannot view deals belonging to farmer '${farmerId}'`, 403);
    return next(err);
  }

  // Buyers can only view their own purchases
  if (buyerId && user.role === 'buyer' && user.id !== buyerId) {
    const err = new AuthError(`Access denied: you cannot view deals belonging to buyer '${buyerId}'`, 403);
    return next(err);
  }

  return next();
}

/**
 * Ensures user is authorized to view or mutate a deal.
 * Used on GET /deals/:id, PATCH /deals/:id/status, PATCH /deals/:id/cancel
 */
function authorizeDealParticipant(deal, user) {
  if (!user || !user.id) return; // If unauthenticated in non-strict mode
  if (user.role === 'admin' || user.role === 'system') return; // Admins allowed

  const isParticipant = deal.farmerId === user.id || deal.buyerId === user.id;
  if (!isParticipant) {
    const err = new AuthError(`Access denied: you are neither the farmer nor the buyer for deal '${deal.id}'`, 403);
    throw err;
  }
}

module.exports = {
  AuthError,
  requireAuth,
  authorizeDealAccess,
  authorizeDealParticipant,
  extractToken,
  verifyToken,
};
