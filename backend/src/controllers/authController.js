// Auth controller - thin layer over authService.
// Exposes login, register, me, refresh and logout.

const authService = require('../services/authService');

/**
 * POST /api/auth/login
 *
 * Unauthenticated by necessity. The only thing a caller supplies is a role, an
 * identifier and a password; the identity in the response comes from the
 * database and the token is signed server-side.
 */
async function login(req, res, next) {
  try {
    const data = await authService.login(req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/register
 *
 * Creates the profile and its credential together and returns 201 with no
 * token: the client authenticates by calling /login afterwards.
 */
async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/me
 *
 * Reads req.user, which requireAuth populated from the verified JWT, and
 * nothing else: no body, query, path parameter, cookie or header is consulted.
 * Issues no token and touches no credential state.
 */
async function me(req, res, next) {
  try {
    const data = await authService.me(req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/refresh
 *
 * Unauthenticated in the requireAuth sense: the refresh token in the body IS
 * the credential. Presenting it rotates it and returns a new pair.
 */
async function refresh(req, res, next) {
  try {
    const data = await authService.refresh(req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/logout
 *
 * Unauthenticated in the requireAuth sense: the refresh token in the body is the
 * credential. Revokes the token's family and returns a minimal acknowledgement.
 */
async function logout(req, res, next) {
  try {
    const data = await authService.logout(req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, register, me, refresh, logout };
