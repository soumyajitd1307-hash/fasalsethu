/**
 * Public JWKS Routes.
 *
 * Mounted at /.well-known, NOT under /api: the verifier derives the JWKS URL
 * from the issuer as <issuer>/.well-known/jwks.json, so this must resolve at
 * the origin root. It is deliberately unauthenticated — it is a public key
 * document, and requiring a token to fetch the keys needed to validate a token
 * would be circular.
 */

const express = require('express');
const { getJwks } = require('../controllers/jwksController');

const router = express.Router();

// GET /.well-known/jwks.json
router.get('/jwks.json', getJwks);

module.exports = router;
