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

function forbidden(message) {
  return new AuthError(message || 'Forbidden', 403);
}

// Roles that are allowed to read across participants. They are the ONLY
// exception to owner scoping, and they are intentionally explicit: a farmer or
// buyer can never widen their own scope, whatever the request asks for.
const PRIVILEGED_ROLES = new Set(['admin', 'system']);

function isPrivileged(user) {
  return Boolean(user && user.id && PRIVILEGED_ROLES.has(user.role));
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
 *
 * The check is role-agnostic on purpose: a token may only read the history of
 * the participant type it claims. A buyer token is therefore refused farmer
 * history (and vice versa), and any other role is refused both.
 */
function authorizeDealAccess(req, res, next) {
  const user = req.user;
  if (!user || !user.id) {
    const err = new AuthError('Authentication required to access deal transactions.', 401);
    return next(err);
  }

  if (isPrivileged(user)) return next();

  const farmerId = req.params.farmerId;
  const buyerId = req.params.buyerId;

  // Farmers can only view their own deals
  if (farmerId && !(user.role === 'farmer' && user.id === farmerId)) {
    const err = forbidden(`Access denied: you cannot view deals belonging to farmer '${farmerId}'`);
    return next(err);
  }

  // Buyers can only view their own purchases
  if (buyerId && !(user.role === 'buyer' && user.id === buyerId)) {
    const err = forbidden(`Access denied: you cannot view deals belonging to buyer '${buyerId}'`);
    return next(err);
  }

  return next();
}

/**
 * Single source of truth mapping a verified identity to the deals it may see
 * in COLLECTION endpoints (list, summary). Identity is taken exclusively from
 * the verified JWT `sub` established by requireAuth — never from query, body
 * or client headers.
 *
 * @returns {{farmerId: string}|{buyerId: string}|null} owner filter, or null for
 *   privileged roles (admin/system), which may read across participants.
 * @throws {AuthError} 401 when there is no verified identity, 403 when the
 *   role has no business reading deal data at all.
 */
function dealScopeFor(user) {
  if (!user || !user.id) {
    throw new AuthError('Authentication required to access deal data', 401);
  }
  if (isPrivileged(user)) return null;
  if (user.role === 'farmer') return { farmerId: user.id };
  if (user.role === 'buyer') return { buyerId: user.id };
  throw forbidden(`Access denied: role '${user.role}' may not access deal data`);
}

/**
 * Ensures user is authorized to view or mutate a deal.
 * Used on GET /deals/:id, PATCH /deals/:id/status, PATCH /deals/:id/cancel
 */
function authorizeDealParticipant(deal, user) {
  // No verified identity means no access at all: never fall open.
  if (!user || !user.id) {
    throw new AuthError('Authentication required to access this deal', 401);
  }
  if (isPrivileged(user)) return; // Admins allowed

  const isParticipant = deal.farmerId === user.id || deal.buyerId === user.id;
  if (!isParticipant) {
    const err = forbidden(`Access denied: you are neither the farmer nor the buyer for deal '${deal.id}'`);
    throw err;
  }
}

module.exports = {
  AuthError,
  requireAuth,
  authorizeDealAccess,
  authorizeDealParticipant,
  dealScopeFor,
  isPrivileged,
  extractToken,
  verifyToken,
};
