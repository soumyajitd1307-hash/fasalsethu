const jose = require('jose');
const env = require('../config/env');

const issuer = env.auth0IssuerBaseUrl.endsWith('/')
  ? env.auth0IssuerBaseUrl
  : `${env.auth0IssuerBaseUrl}/`;

const JWKS = jose.createRemoteJWKSet(
  new URL('.well-known/jwks.json', issuer)
);

/**
 * Extracts Bearer token from Authorization header
 */
function extractToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

/**
 * Verifies Auth0 RS256 JWT:
 * - Checks cryptographic signature against Auth0 JWKS
 * - Validates issuer (https://<auth0-domain>/)
 * - Validates audience when AUTH0_AUDIENCE is configured
 * - Validates expiration (exp) and active status (nbf)
 */
async function verifyAuth0Token(token) {
  const verifyOptions = {
    issuer,
    algorithms: ['RS256'],
  };

  if (env.auth0Audience) {
    verifyOptions.audience = env.auth0Audience;
  }

  const { payload } = await jose.jwtVerify(token, JWKS, verifyOptions);
  return payload;
}

/**
 * Require valid Auth0 JWT token on protected routes.
 * Rejects missing or invalid tokens with HTTP 401.
 * Exposes verified claims on req.user.
 */
async function requireAuth(req, res, next) {
  // Allow test environments to bypass token check if explicitly requested
  if (env.nodeEnv === 'test' && process.env.DISABLE_AUTH_FOR_TESTS === 'true') {
    req.user = { sub: 'test-authenticated-user', email: 'test@fasalsethu.in' };
    return next();
  }

  const token = extractToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or malformed Authorization header with Bearer token',
    });
  }

  try {
    const payload = await verifyAuth0Token(token);
    req.user = {
      sub: payload.sub,
      email: payload.email,
      scope: payload.scope,
      ...payload,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: `Unauthorized: ${err.message || 'Invalid or expired token'}`,
    });
  }
}

/**
 * Optional authentication: attaches user if token is present, allows request if omitted.
 */
async function optionalAuth(req, res, next) {
  if (!req.headers.authorization) {
    return next();
  }
  return requireAuth(req, res, next);
}

module.exports = {
  requireAuth,
  optionalAuth,
  verifyAuth0Token,
};
