/**
 * Auth Routes (first-party credentials).
 *
 * Login and register are unauthenticated by necessity: login is what produces
 * the Bearer token and register is what creates the credential. /me is the
 * opposite — it is protected by the same requireAuth as every other protected
 * route. /refresh and /logout are unauthenticated too, because the opaque
 * refresh token in their body is itself the credential. Logout deliberately
 * does NOT require an access token, so signing out still works once the access
 * token has expired.
 *
 * Every route is rate limited BEFORE body validation, so a flood of malformed
 * payloads is throttled as well. Credential endpoints (login, register) share
 * one budget and token endpoints (refresh, logout) share a separate, larger
 * one, so token traffic can never exhaust the sign-in allowance. See
 * middleware/rateLimit.js.
 */

const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { credentialLimiter, tokenLimiter } = require('../middleware/rateLimit');
const { authLoginSchema, authRegisterSchema, authRefreshSchema, validateBody } = require('../utils/validate');

const router = express.Router();

// POST /api/auth/login
router.post('/login', credentialLimiter, validateBody(authLoginSchema), authController.login);

// POST /api/auth/register
router.post('/register', credentialLimiter, validateBody(authRegisterSchema), authController.register);

// GET /api/auth/me — the caller's own profile, from the verified identity only.
// There is deliberately no /me/:id: the identity is never caller-selectable.
router.get('/me', requireAuth, authController.me);

// POST /api/auth/refresh — rotates a refresh token into a new token pair.
router.post('/refresh', tokenLimiter, validateBody(authRefreshSchema), authController.refresh);

// POST /api/auth/logout — revokes the presented refresh token's whole family.
// Shares authRefreshSchema: the request body is the refresh-token credential,
// validated identically.
router.post('/logout', tokenLimiter, validateBody(authRefreshSchema), authController.logout);

module.exports = router;
